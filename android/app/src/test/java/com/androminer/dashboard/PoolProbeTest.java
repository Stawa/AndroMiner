package com.androminer.dashboard;

import static org.junit.Assert.*;

import java.net.InetAddress;
import java.net.ServerSocket;
import java.util.List;
import org.junit.Test;

public class PoolProbeTest {
    @Test
    public void invalidConfigurationDoesNotReachNetwork() {
        for (String host :
                new String[] {
                    "",
                    "https://pool.example",
                    "pool.example/path",
                    "name@pool.example",
                    "host name"
                }) {
            List<PoolProbe.Stage> result = PoolProbe.run(host, 3333, true);
            assertEquals(1, result.size());
            assertEquals("hostname", result.get(0).stage);
            assertFalse(result.get(0).passed);
        }
        assertFalse(PoolProbe.run("localhost", 0, false).get(0).passed);
    }

    @Test
    public void tcpSuccessDoesNotClaimAuthentication() throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            List<PoolProbe.Stage> result = PoolProbe.run("127.0.0.1", server.getLocalPort(), false);
            assertTrue(result.stream().anyMatch(s -> s.stage.equals("tcp") && s.passed));
            assertTrue(
                    result.get(result.size() - 1).detail.contains("credentials were not tested"));
        }
    }

    @Test
    public void tlsFailureNeverReportsPlaintextSuccess() throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            Thread peer =
                    new Thread(
                            () -> {
                                try (java.net.Socket socket = server.accept()) {
                                    socket.getOutputStream().write("plain text\n".getBytes());
                                } catch (Exception ignored) {
                                }
                            });
            peer.start();
            List<PoolProbe.Stage> result = PoolProbe.run("127.0.0.1", server.getLocalPort(), true);
            peer.join(5000);
            assertTrue(result.stream().anyMatch(s -> s.stage.equals("tls") && !s.passed));
            assertFalse(result.stream().anyMatch(s -> s.stage.equals("protocol")));
            for (PoolProbe.Stage stage : result) assertFalse(stage.detail.contains("127.0.0.1"));
        }
    }
}
