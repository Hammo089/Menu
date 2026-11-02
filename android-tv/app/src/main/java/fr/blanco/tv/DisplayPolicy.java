package fr.blanco.tv;

/** Foreground requests never override an owner exit, maintenance, or TV sleep. */
public final class DisplayPolicy {
  public static boolean mayResume(
      boolean paired,
      boolean revoked,
      boolean ownerExited,
      boolean foreground,
      boolean awake,
      boolean maintenance) {
    return paired && !revoked && !ownerExited && !foreground && awake && !maintenance;
  }

  public static final class ExitGesture {
    private long first = -1;
    private int count;

    /** Seven distinct presses within five seconds, measured with a monotonic clock. */
    public int press(long elapsed) {
      if (first < 0 || elapsed < first || elapsed - first > 5000) {
        first = elapsed;
        count = 0;
      }
      count++;
      if (count == 7) {
        first = -1;
        count = 0;
        return 7;
      }
      return count;
    }
  }

  private DisplayPolicy() {}
}
