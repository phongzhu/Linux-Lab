# LinuxLab simulation model

LinuxLab does not launch Bash or execute learner input on the web server. The shell is a JavaScript interpreter in `executor.js`; it tokenizes a small command grammar and mutates an attempt's JSON state. The API route and service persist that state in Supabase.

## Request and persistence path

`frontend/src/components/Terminal.js` submits a command through `frontend/src/services/learningApi.js`. The authenticated request reaches `backend/src/routes/attemptRoutes.js`, then `backend/src/services/attemptService.js`, which calls `backend/src/simulation/executor.js` and `backend/src/simulation/taskEvaluator.js`. `record_attempt_command` in the Supabase migrations saves the new state and command record together. The command record includes `cwd_before`, `cwd_after`, `stdout`, `stderr`, and `exit_code`; the older `cwd`, `output`, and `succeeded` fields remain for compatibility.

The filesystem is a map of normalized absolute paths to file/directory nodes inside each attempt's JSON state. `normalizeEnvironment` repairs missing ancestor directories before a command runs. Relative paths resolve from cwd; absolute paths, `.`, `..`, and trailing slashes normalize through `resolvePath`. A failed `cd` does not change cwd. Historical terminal prompts use `cwdBefore`, not the attempt's latest cwd.

## Command behavior and limits

| Area | Current behavior |
| --- | --- |
| Files | `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`, `cp`, `mv`, `rm`, `tree`, `find`, `file`, and `du` operate on attempt files. Options are a documented subset; this is not GNU coreutils. The A02 fixture also models owner/group/mode reads and the constrained `chmod`, `chgrp`, `chown`, and `sudo -u` commands. |
| Text | `echo`, `printf`, `head`, `tail`, `grep`, `wc`, `sort`, and `uniq` read in-memory file contents. Grep returns code 0 for matches, code 1 with empty output for ordinary no-match searches (or `0` stdout for `-c`), and code 2 with stderr for invalid options. Missing-file errors are nonzero. |
| Pipelines | `|` passes each successful command's stdout to the next stage. A failed stage supplies empty stdin. The final stage determines the pipeline exit code (pipefail is not implemented); stderr from failed stages is retained separately. |
| Redirection | One final `>` or `>>` target is supported, including quoted target names with spaces. `>` truncates and `>>` appends. stderr redirection is unsupported. |
| Host/system facts | `whoami`, `hostname`, `uname`, `date`, and `which` return training-environment information. A03 `ssh`/`exit` uses isolated per-host file maps, training fingerprints, and saved remote state; command history records host/user before and after. A04 provides fixture-backed `ip addr`, `ip route`, `getent hosts`, `ss -ltn`, and endpoint observations. `date` and the base resource/service records are fixed training snapshots, not live host readings. |
| JSON/configuration | `jq` supports `.` and one top-level `.KEY` filter on a file. The simulated `editor set FILE .KEY VALUE` changes one top-level JSON value. These are narrow lab tools, not full jq or an interactive editor. |
| Services and endpoints | `systemctl status/start/stop/restart/reload` updates configured service state only for the authorized training-admin role. A01 derives its endpoint from JSON port and service state; A05 derives health from the current pool-size setting and restart state, and appends service logs. Other seeded `curl` endpoints remain fixtures. |
| Practice database | A06 `psql -h HOST -p PORT -U USER DATABASE` opens a fictional session stored inside attempt state, separate from the host filesystem and LinuxLab's Supabase data. `CREATE TABLE`, multi-row `INSERT`, equality-filtered `SELECT`, `COUNT(*)`, `\\conninfo`, `\\dt`, `\\d TABLE`, and `\\q` mutate or inspect it. This is a limited SQL subset, not PostgreSQL. |
| Archives and transfers | A07 supports `tar -czf`, `tar -tzf`, and `tar -xzf ... -C ...` for file archives stored in attempt state; `scp` copies a file between the local filesystem and a fingerprint-pinned fictional host; `sha256sum` computes SHA-256 over file content or archive manifest. These are constrained training forms, not system tar/OpenSSH. |
| Scripts and scheduling | A08 `bash SCRIPT` accepts only lines shaped as `echo "Host: $HOSTNAME"`, `echo "Disk: $DISK"`, `echo "Memory: $MEMORY"`, and `echo "Service: $SERVICE"`. Script output reflects attempt state. `crontab add "MIN HOUR * * * SCRIPT" UTC|Asia/Manila` stores a fictional schedule; `training-clock advance Nm|Nh|Nd` moves only the attempt clock and generates reports when a scheduled minute is crossed. No OS process, shell, or cron daemon is started. |
| Containers and DDEV | A09 `docker ps [-a]`, `images`, `inspect`, `logs`, and lifecycle verbs read or update attempt container records. `ddev list`, `describe`, and `logs` inspect a separate project record; `ddev config --router-https-port PORT` and project lifecycle commands update the project URL and endpoint response. DDEV startup logs and app logs are separate files. These are fictional state transitions; Docker/DDEV are never launched. |
| Printer queues | A10 `lpinfo -v` lists only the virtual catalog; `lpadmin -p NAME -E -v URI -m everywhere` accepts catalog URIs under the training-admin role; `lpstat -p/-o` reads queue and job state; `lp -d QUEUE FILE` allocates a stateful job ID; `cancel QUEUE-ID` changes only that job. No printer discovery, network request, or physical printing occurs. |
| Training metrics dashboards | B01 uses dashboard controls rather than Linux commands. Scope, dashboard selection, metric statistic/period, freshness, same-window host comparisons, success/failure rates, historical sample means, missing samples, and buffer calculations are recorded in the attempt state. Metric values and dates are fictional scenario fixtures, not live CloudWatch data. |
| Monitoring-style shell commands | `ps`, `top`, `df`, `free`, and `journalctl` are limited training views. Several values and URL payloads are fixtures, not general command implementations. |
| Manuals | `help`, `man`, `less`, and `more` provide short simulated help/text views, not a complete manual database or interactive pager. |
| Syntax | Quotes and backslash escapes are handled by a small lexer. `;`, `&`, `<`, `&&`, variable/command substitution, backticks, stderr redirection, multiple redirects, and redirects before the final pipeline stage return explicit unsupported-syntax errors. Shell expansion, globbing, job control, and a POSIX shell grammar are not implemented. Bare `>` is an incomplete redirect and returns a syntax error. |

The pipeline finding is therefore **partially supported**: stdout is passed between stages and normal final-command status behavior is used, but this is not a full Bash pipeline and does not implement `set -o pipefail`.

## Interface shortcuts

`frontend/src/components/Terminal.js` implements:

- Up/Down to select previous/next command history entries.
- Tab to complete a uniquely matching command or path entry. It does not list multiple candidates or parse every shell quoting context.
- Ctrl+L to clear the visible terminal output by recording a `clear` command.
- Ctrl+C to clear the current input line. It does not interrupt a running process because commands are synchronous simulations.

## Not implemented by the current shell

The A01 configuration, A02 permission, A03 remote-host, A04.1–A04.2 network, A05 service/log, A06 database, A07 archive/transfer, A08 script/scheduler, A09 container/DDEV, A10 printer, and B01 training-metrics workflows have state-backed task validation. A03/A07 remote host state is fictional data inside attempt JSON; commands do not open network connections. A04.3 and B02–B05 can be opened and attempted without prerequisite gates, but their monitoring/alarm/reporting workspaces and task validation remain in development. A lesson's implementationStatus is informational and does not prevent launching an attempt; unfinished lessons do not count as complete until their validators are implemented.
