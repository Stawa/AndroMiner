package com.androminer.dashboard;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONException;

/** One bounded row per run; SQLite transactions preserve the previous checkpoint on failure. */
final class SessionJournal extends SQLiteOpenHelper {
    SessionJournal(Context context) {
        super(context, "mining-sessions.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE sessions (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, record TEXT NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("Unsupported session history version.");
    }

    synchronized void save(JSObject record) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("id", record.optString("id"));
            values.put("updated", record.optLong("updatedAt"));
            values.put("record", record.toString());
            db.replaceOrThrow("sessions", null, values);
            db.execSQL(
                    "DELETE FROM sessions WHERE id NOT IN (SELECT id FROM sessions ORDER BY updated DESC LIMIT 100)");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized JSArray records() {
        JSArray result = new JSArray();
        try (Cursor rows =
                getReadableDatabase()
                        .rawQuery(
                                "SELECT record FROM sessions ORDER BY updated DESC LIMIT 100",
                                null)) {
            while (rows.moveToNext()) {
                try {
                    result.put(new JSObject(rows.getString(0)));
                } catch (JSONException malformedRow) {
                    /* Isolate a damaged row from the remaining history. */
                }
            }
        }
        return result;
    }

    synchronized JSObject latest() {
        JSArray rows = records();
        return rows.length() == 0 ? null : (JSObject) rows.opt(0);
    }

    synchronized void recoverInterrupted() {
        JSArray rows = records();
        for (int i = 0; i < rows.length(); i++) {
            JSObject record = (JSObject) rows.opt(i);
            if (record.isNull("endedAt")) {
                record.put("state", "failed");
                record.put("reasonCode", "unexpected_termination");
                record.put(
                        "endReason",
                        "Android ended the previous session. Duration ends at the last saved observation.");
                record.put("endedAt", record.optLong("updatedAt"));
                record.put("stateChangedAt", record.optLong("updatedAt"));
                record.put("interrupted", true);
                save(record);
            }
        }
    }

    synchronized void delete(String id) {
        // Active runs cannot be deleted while the watchdog is updating their checkpoint.
        JSArray rows = records();
        for (int i = 0; i < rows.length(); i++) {
            JSObject row = (JSObject) rows.opt(i);
            if (!row.isNull("endedAt") && (id == null || id.equals(row.optString("id"))))
                getWritableDatabase()
                        .delete("sessions", "id = ?", new String[] {row.optString("id")});
        }
    }
}
