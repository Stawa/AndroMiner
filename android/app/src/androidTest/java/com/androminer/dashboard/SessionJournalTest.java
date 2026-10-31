package com.androminer.dashboard;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class SessionJournalTest {
    private SessionJournal journal;
    private Context context;

    @Before
    public void setup() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(
                "Run only against the isolated validation application",
                "com.androminer.validation",
                context.getPackageName());
        context.deleteDatabase("mining-sessions.db");
        journal = new SessionJournal(context);
    }

    @After
    public void cleanup() {
        if (journal != null) journal.close();
    }

    private JSObject row(String id, long at, boolean active) {
        JSObject row = new JSObject();
        row.put("id", id);
        row.put("startedAt", at);
        row.put("updatedAt", at + 100);
        row.put("endedAt", active ? JSONObject.NULL : at + 100);
        row.put("state", active ? "running" : "stopped");
        return row;
    }

    @Test
    public void reopenRecoversOnceAtLastObservation() {
        journal.save(row("active", 1000, true));
        journal.close();
        journal = new SessionJournal(context);
        journal.recoverInterrupted();
        journal.recoverInterrupted();
        assertEquals(1, journal.records().length());
        JSObject record = journal.latest();
        assertEquals("unexpected_termination", record.optString("reasonCode"));
        assertEquals(1100, record.optLong("endedAt"));
        assertEquals("failed", record.optString("state"));
    }

    @Test
    public void failedTransactionPreservesPreviousRecord() {
        journal.save(row("saved", 1000, false));
        journal.getWritableDatabase()
                .execSQL(
                        "CREATE TRIGGER reject_save BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'test storage failure'); END");
        assertThrows(
                android.database.sqlite.SQLiteException.class,
                () -> journal.save(row("saved", 2000, false)));
        assertEquals(1100, journal.latest().optLong("updatedAt"));
    }

    @Test
    public void damagedRowDoesNotEraseHealthyHistory() {
        journal.save(row("good", 1000, false));
        journal.getWritableDatabase()
                .execSQL("INSERT INTO sessions VALUES ('bad', 9999, '{broken')");
        assertEquals(1, journal.records().length());
        assertEquals("good", journal.latest().optString("id"));
    }

    @Test
    public void retentionAndDeletionPreserveActiveRun() {
        for (int i = 0; i < 120; i++) journal.save(row("run-" + i, i, false));
        journal.save(row("active", 5000, true));
        assertEquals(100, journal.records().length());
        journal.delete(null);
        JSArray rows = journal.records();
        assertEquals(1, rows.length());
        assertEquals("active", journal.latest().optString("id"));
    }
}
