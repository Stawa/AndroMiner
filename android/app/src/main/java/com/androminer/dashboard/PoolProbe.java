package com.androminer.dashboard;

import java.net.IDN;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/** Reachability only: no wallet, password, login, port substitution, or TLS downgrade. */
final class PoolProbe {
    static final class Stage {
        final String stage;
        final boolean passed;
        final String detail;

        Stage(String stage, boolean passed, String detail) {
            this.stage = stage;
            this.passed = passed;
            this.detail = detail;
        }
    }

    private static final ExecutorService resolver =
            Executors.newSingleThreadExecutor(
                    r -> {
                        Thread thread = new Thread(r, "pool-dns");
                        thread.setDaemon(true);
                        return thread;
                    });
    private static Future<InetAddress[]> resolution;

    static synchronized List<Stage> run(String host, int port, boolean tls) {
        List<Stage> stages = new ArrayList<>();
        try {
            host = normalizeHost(host);
            if (port < 1 || port > 65535) throw new IllegalArgumentException();
            stages.add(new Stage("hostname", true, "Host and port are valid."));
        } catch (IllegalArgumentException invalid) {
            stages.add(
                    new Stage(
                            "hostname",
                            false,
                            "Enter a hostname or IP address and a port from 1 to 65535; omit URLs and paths."));
            return stages;
        }
        InetAddress[] addresses;
        try {
            if (resolution != null && !resolution.isDone()) {
                stages.add(
                        new Stage(
                                "dns",
                                false,
                                "The previous DNS lookup is still pending. Try again later."));
                return stages;
            }
            final String hostname = host;
            resolution = resolver.submit(() -> InetAddress.getAllByName(hostname));
            addresses = resolution.get(5, TimeUnit.SECONDS);
            stages.add(new Stage("dns", true, "Resolved " + addresses.length + " address(es)."));
        } catch (Exception failure) {
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            stages.add(
                    new Stage(
                            "dns",
                            false,
                            failure instanceof java.util.concurrent.TimeoutException
                                    ? "DNS lookup timed out."
                                    : "DNS resolution failed."));
            return stages;
        }
        int attempts = 0;
        // Interleave address families so a list of unreachable IPv6 entries cannot starve IPv4.
        List<InetAddress> ordered = new ArrayList<>();
        List<InetAddress> v4 = new ArrayList<>(), v6 = new ArrayList<>();
        for (InetAddress address : addresses)
            (address instanceof Inet6Address ? v6 : v4).add(address);
        for (int i = 0; i < Math.max(v4.size(), v6.size()); i++) {
            if (i < v6.size()) ordered.add(v6.get(i));
            if (i < v4.size()) ordered.add(v4.get(i));
        }
        for (InetAddress address : ordered) {
            if (++attempts > 4) break;
            String family = address instanceof Inet6Address ? "IPv6" : "IPv4";
            boolean tcp = false;
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(address, port), 2500);
                socket.setSoTimeout(4000);
                tcp = true;
                stages.add(new Stage("tcp", true, family + " connection succeeded."));
                if (tls) {
                    try (SSLSocket secure =
                            (SSLSocket)
                                    ((SSLSocketFactory) SSLSocketFactory.getDefault())
                                            .createSocket(socket, host, port, true)) {
                        secure.setSoTimeout(4000);
                        SSLParameters parameters = secure.getSSLParameters();
                        parameters.setEndpointIdentificationAlgorithm("HTTPS");
                        secure.setSSLParameters(parameters);
                        secure.startHandshake();
                        stages.add(
                                new Stage(
                                        "tls",
                                        true,
                                        family + " TLS certificate and hostname verified."));
                    }
                }
                stages.add(
                        new Stage(
                                "protocol",
                                true,
                                "Reachability verified only. Pool login and credentials were not tested."));
                return stages;
            } catch (Exception failure) {
                String detail =
                        failure instanceof SocketTimeoutException
                                ? "Connection timed out."
                                : failure instanceof SSLHandshakeException
                                        ? "TLS certificate, hostname, or handshake rejected."
                                        : tcp
                                                ? "TLS handshake failed; the port may use a different protocol."
                                                : "Host or port unreachable.";
                stages.add(new Stage(tcp ? "tls" : "tcp", false, family + ": " + detail));
            }
        }
        return stages;
    }

    static String normalizeHost(String raw) {
        String host = raw == null ? "" : raw.trim();
        if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length() - 1);
        if (host.contains(":")) {
            if (!host.matches("[0-9a-fA-F:]+")
                    || !host.contains("::") && host.chars().filter(c -> c == ':').count() != 7)
                throw new IllegalArgumentException();
            return host;
        }
        host = IDN.toASCII(host, IDN.USE_STD3_ASCII_RULES);
        if (host.isEmpty() || host.length() > 253 || host.contains("/") || host.contains("@"))
            throw new IllegalArgumentException();
        return host;
    }
}
