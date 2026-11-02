#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TASK_ROOT/build/policy-tests"
javac -d "$TASK_ROOT/build/policy-tests" "$TASK_ROOT/app/src/main/java/fr/blanco/tv/PinPolicy.java" "$TASK_ROOT/app/src/main/java/fr/blanco/tv/SchedulePolicy.java" "$TASK_ROOT/tests/PolicyTest.java"
java -cp "$TASK_ROOT/build/policy-tests" PolicyTest
