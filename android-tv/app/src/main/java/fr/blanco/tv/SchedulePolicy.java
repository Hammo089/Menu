package fr.blanco.tv;

import java.time.*;
import java.util.*;

public final class SchedulePolicy {
  public static final class Window {
    public final int day, start, end;
    public final boolean enabled;

    public Window(int day, boolean enabled, String start, String end) {
      this.day = day;
      this.enabled = enabled;
      this.start = parse(start);
      this.end = parse(end);
    }
  }

  static int parse(String s) {
    if (!s.matches("([01][0-9]|2[0-3]):[0-5][0-9]"))
      throw new IllegalArgumentException("Invalid time");
    return Integer.parseInt(s.substring(0, 2)) * 60 + Integer.parseInt(s.substring(3));
  }

  public static boolean open(
      String override, boolean enabled, List<Window> windows, ZonedDateTime instant) {
    if ("open".equals(override)) return true;
    if ("closed".equals(override)) return false;
    if (!enabled) return true;
    ZonedDateTime local = instant.withZoneSameInstant(ZoneId.of("Europe/Paris"));
    int day = local.getDayOfWeek().getValue(), minute = local.getHour() * 60 + local.getMinute();
    for (Window w : windows) {
      if (!w.enabled || w.start == w.end) continue;
      if (w.start < w.end) {
        if (w.day == day && minute >= w.start && minute < w.end) return true;
      } else if ((w.day == day && minute >= w.start) || ((w.day % 7) + 1 == day && minute < w.end))
        return true;
    }
    return false;
  }

  private SchedulePolicy() {}
}
