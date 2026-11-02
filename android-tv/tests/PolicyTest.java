import fr.blanco.tv.DisplayPolicy;
import fr.blanco.tv.PinPolicy;
import fr.blanco.tv.SchedulePolicy;
import java.time.*;
import java.util.*;

public class PolicyTest {
  static int assertions = 0;

  static void check(boolean value, String message) {
    assertions++;
    if (!value) throw new AssertionError(message);
  }

  static ZonedDateTime at(String s) {
    return Instant.parse(s).atZone(ZoneOffset.UTC);
  }

  public static void main(String[] args) {
    DisplayPolicy.ExitGesture gesture = new DisplayPolicy.ExitGesture();
    for (int i = 0; i < 6; i++)
      check(gesture.press(1000 + i * 400) < 7, "Six presses must not open PIN");
    check(gesture.press(3400) == 7, "Seventh press opens PIN exactly once");
    check(gesture.press(3500) == 1, "Gesture resets after unlock prompt");
    check(gesture.press(9000) == 1, "Slow unrelated presses must not accumulate");
    for (int i = 0; i < 5; i++) gesture.press(9100 + i * 100);
    check(gesture.press(9700) == 7, "New seven-press sequence works after timeout");
    check(
        DisplayPolicy.mayResume(true, false, false, false, true, false),
        "Active display resumes on wake");
    check(
        !DisplayPolicy.mayResume(true, false, true, false, true, false),
        "PIN exit is respected even on wake");
    check(
        !DisplayPolicy.mayResume(true, false, true, false, false, false),
        "PIN exit also stays closed asleep");
    check(
        !DisplayPolicy.mayResume(true, false, false, false, false, false),
        "Never launch into TV sleep");
    check(
        !DisplayPolicy.mayResume(true, false, false, false, true, true),
        "Owner maintenance may use TV settings");
    check(
        !DisplayPolicy.mayResume(false, false, false, false, true, false),
        "Unpaired screen may not take focus");
    check(
        !DisplayPolicy.mayResume(true, true, false, false, true, false),
        "Revoked screen may not take focus");
    check(
        !DisplayPolicy.mayResume(true, false, false, true, true, false),
        "Do not reload active display");
    String salt = "000102030405060708090a0b0c0d0e0f",
        hash = "2f59d5cc202e6a80df5c7d1029b1bf44f6b09c46a483a78f84b2f838d772f202";
    check(
        PinPolicy.verify("482951".toCharArray(), salt, hash, 210000),
        "PBKDF2 must match browser/Node SHA256 vector");
    check(
        !PinPolicy.verify("482952".toCharArray(), salt, hash, 210000), "Wrong PIN denied offline");
    check(
        !PinPolicy.verify("482951".toCharArray(), salt, hash, 1000),
        "Weak KDF configuration refused");
    check(PinPolicy.lockUntil(4, 1000) == 0, "First attempts allowed");
    check(PinPolicy.lockUntil(5, 1000) == 61000, "Cooldown after five wrong attempts");
    check(PinPolicy.lockUntil(10, 1000) == 121000, "Repeated lockout increases");
    check(PinPolicy.lockUntil(500, 1000) == 1801000, "Cooldown capped at thirty minutes");
    Set<String> tokens = new HashSet<>();
    for (int i = 0; i < 100; i++) tokens.add(PinPolicy.randomToken());
    check(tokens.size() == 100, "Per-device secrets are unique 256-bit tokens");
    List<SchedulePolicy.Window> windows =
        Arrays.asList(new SchedulePolicy.Window(6, true, "20:00", "02:00"));
    check(
        SchedulePolicy.open("auto", true, windows, at("2026-10-31T19:00:00Z")),
        "French opening hour");
    check(
        SchedulePolicy.open("auto", true, windows, at("2026-11-01T00:30:00Z")),
        "Saturday carries into Sunday");
    check(
        !SchedulePolicy.open("auto", true, windows, at("2026-11-01T01:00:00Z")),
        "End is exclusive");
    check(
        !SchedulePolicy.open("closed", false, windows, at("2026-10-31T20:00:00Z")),
        "Manual black overrides disabled schedule");
    check(
        SchedulePolicy.open("open", true, windows, at("2026-11-02T04:00:00Z")),
        "Manual display overrides schedule");
    List<SchedulePolicy.Window> dst =
        Arrays.asList(new SchedulePolicy.Window(7, true, "02:00", "03:00"));
    check(SchedulePolicy.open("auto", true, dst, at("2026-10-25T00:30:00Z")), "First DST 02:30");
    check(SchedulePolicy.open("auto", true, dst, at("2026-10-25T01:30:00Z")), "Repeated DST 02:30");
    check(
        !SchedulePolicy.open("auto", true, dst, at("2026-10-25T02:00:00Z")),
        "DST window ends at local 03:00");
    System.out.println("Android policy checks passed: " + assertions);
  }
}
