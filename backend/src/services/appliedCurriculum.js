import { createHash } from 'node:crypto';
import { validateMonitoringTask } from '../simulation/monitoring.js';
import { validateIncidentTask } from '../simulation/incident.js';
import { validateRequestLabTask } from '../simulation/requestTracing.js';
import { validateSecurityTask } from '../simulation/security.js';
import { validateDeploymentTask } from '../simulation/deployment.js';

const sectionId = 'applied-linux-sre';
const foundations = ['u1l1', 'u1l2', 'u1l3'];
const unitDefinitions = [
  { track: 'applied-linux', code: 'A01', title: 'Files and application configuration', subtitle: 'Inspect, change, and verify an application setting.', role: 'training administrator', workspace: 'local-shell', tools: ['ls','cd','cat','head','grep','cp','editor','jq','curl'], scenarios: [
    ['Inspect the configuration','A fictional API in /opt/training-api is configured for port 8080 while its runbook requests 8081. Locate both sources and establish the mismatch before editing.',['Find the application directory and configuration.','Read the configured port and runbook endpoint.','Record the observed mismatch with both file paths.'],['Config and runbook paths are identified.','Both values are supported by file evidence.','Finding states 8080 vs 8081 without changing files.']],
    ['Make a controlled configuration change','A maintenance window authorizes changing only the training app port to 8081. Back up the original file, use the simulated editor, then validate syntax and value.',['Create a backup and compare its contents with the original.','Edit only the permitted port setting.','Validate JSON syntax and confirm port 8081.'],['Backup preserves original content.','Only the authorized value changed.','JSON parses and port is 8081.']],
    ['Verify the application','The config now specifies 8081. Reload only the authorized lab service, test the endpoint, inspect fresh logs, and explain what the check proves.',['Reload the fictional service and inspect its status.','Request the configured health endpoint.','Hand over the change and cite endpoint and log evidence.'],['Reload is reflected in service state/logs.','Port 8081 responds healthy.','Handoff distinguishes restart from verified recovery.']],
  ], prerequisites: [], intro: 'Configuration is a source of desired settings; the runbook is a separate expectation. The simulated editor shows save and quit controls before editing is required.', explanations: ['A file path and its parent directories must both exist.','Backups preserve rollback evidence; jq checks JSON syntax, not application correctness.','A reload response alone does not prove the application works; test the configured endpoint and inspect logs.'] },
  { track: 'applied-linux', code: 'A02', title: 'Users, groups, and permissions', subtitle: 'Grant private report access without widening the boundary.', role: 'read-only investigator', workspace: 'local-shell', tools: ['whoami','id','ls -l','chmod','chgrp','chown','sudo'], scenarios: [
    ['Diagnose access','The reporting user cannot read /srv/reports/monthly.csv. Identify user groups and file owner, group, and mode before proposing a change.',['Inspect the current identity and groups.','Read the report metadata.','Explain the denial using the observed permission bits.'],['Identity and group evidence is captured.','File owner/group/mode are identified.','Explanation matches the actual access rule.']],
    ['Grant scoped access','An authorized lab administrator may grant the report-reader group read access. Do not grant world access; chmod 777 is explicitly rejected.',['Use the scoped admin role for the intended access change.','Inspect the resulting owner, group, and mode.','Verify unrelated users still lack read permission.'],['Only the intended group gains access.','Metadata reflects the approved policy.','Other-read stays disabled; 777 is rejected.']],
    ['Verify the boundary','Verify that report-reader can read the report while guest-audit cannot, then report both outcomes.',['Test access as report-reader.','Test access as unrelated guest-audit.','Submit both results and the remaining boundary.'],['Intended read succeeds.','Unrelated read is denied.','Finding is supported by both checks.']],
  ], prerequisites: [], intro: 'Linux checks owner, group, then other permissions. Scoped sudo in this lab changes only fictional training files.', explanations: ['A filename does not reveal its permissions.','Use the narrowest ownership or mode change that grants the required access.','A permission fix is not verified until both permitted and denied access are tested.'] },
  { track: 'applied-linux', code: 'A03', title: 'Remote server access', subtitle: 'Connect to the intended fictional host and keep host state separate.', role: 'read-only investigator', workspace: 'remote-shell', tools: ['ssh','hostname','whoami','pwd','ls','cd','cat','exit'], scenarios: [
    ['Connect to the correct host','The application runs on lab-app-01.training.test. Compare the supplied fictional fingerprint, then connect with the learner account.',['Read the connection and fingerprint note.','Connect to the named host after the supplied identity matches.','Confirm remote hostname and username.'],['Connection target and fingerprint are recorded.','Remote session opens to the assigned host.','hostname and whoami match the exercise.']],
    ['Inspect the remote environment','Collect app version and port evidence from lab-app-01, not the local workstation. Local and remote filesystems may contain similarly named paths.',['Confirm hostname, user, and current directory.','Locate and read remote application configuration.','Record the remote host as the evidence source.'],['Remote identity is proven.','Configuration is read in remote context.','Evidence names the correct host and path.']],
    ['Disconnect and reconnect','A remote-only scratch note was created. Exit, confirm the local host and isolation, reconnect, then verify that the note persists remotely.',['Exit and confirm the local prompt returns.','Verify local host and absence of the remote-only note.','Reconnect and read the persisted remote note.'],['Local session is restored.','Local and remote filesystems remain distinct.','Remote note survives reconnect.']],
  ], prerequisites: [], intro: 'The prompt identifies the active host. SSH sessions and their filesystem changes are simulated and isolated per training host.', explanations: ['Verify the host fingerprint before connecting.','A path on two hosts identifies two different files.','Disconnecting ends the remote session but preserves that host’s simulated state.'] },
  { track: 'applied-linux', code: 'A04', title: 'Networking, DNS, ports, and HTTPS', subtitle: 'Separate name resolution, routing, listening ports, and HTTP/TLS evidence.', role: 'read-only investigator', workspace: 'local-shell', tools: ['ip addr','ip route','getent hosts','ss','curl','WAF evidence'], scenarios: [
    ['Check the destination','A client cannot reach api.training.test. Its DNS answer differs from the destination in the approved client record. Identify the mismatch from supplied evidence.',['Inspect the hostname and its resolved training address.','Inspect local route and client destination record.','Report the conflicting destination with evidence.'],['Hostname and resolver answer are captured.','Route and configured destination are compared.','Mismatch is stated without claiming a route change.']],
    ['Check the listening service','The host resolves correctly but the API is listening on 8443 while another virtual service occupies 443. Distinguish port selection from DNS and app health.',['Inspect listening training ports.','Compare the app port with the requested address.','Test the appropriate endpoint and classify the response.'],['Listening socket state is read.','Service and request ports are separated.','HTTP evidence distinguishes port and application response.']],
    ['Investigate HTTPS or allowlisting','A WAF-style event shows a source address mismatch behind a proxy. Inspect certificate and forwarded-IP evidence; proxy handling is explicitly unconfirmed.',['Inspect certificate hostname, validity, and TLS termination evidence.','Read the WAF event’s source and forwarded-IP fields.','Report supported cause and what needs confirmation.'],['Certificate evidence is recorded.','Proxy source and configured forwarding are compared.','Report does not assume which client IP the allowlist sees.']],
  ], prerequisites: [], intro: 'DNS maps names to addresses; routes select next hops; sockets show listeners; HTTPS adds certificate and hostname checks. These checks are separate.', explanations: ['Changing URL text does not create a valid network route.','A listening port does not guarantee the application returns a healthy response.','An allowlist source can depend on proxy and forwarded-IP configuration.'] },
  { track: 'applied-linux', code: 'A05', title: 'Processes, services, and logs', subtitle: 'Diagnose and recover a fictional unavailable website.', role: 'training administrator', workspace: 'local-shell', tools: ['ps','top','free','df','systemctl','journalctl','grep','tail','curl'], scenarios: [
    ['Inspect system and service status','The training website is unavailable. Begin read-only: inspect app service, processes, and resource readings to identify the affected component.',['Check service state and process snapshot.','Inspect relevant resource readings.','Select the component supported by the evidence.'],['Service and process observations are recorded.','Readings are tied to the supplied host/time.','Component selection cites evidence.']],
    ['Find the failure evidence','Logs contain a connection-pool error during a supplied 09:00–09:05 UTC window. Filter the window and identify the exact event.',['Read app and service logs.','Filter the supplied time range.','Record the specific error and timestamp.'],['Relevant log sources are selected.','Only the requested time window is used.','Finding quotes matching evidence, not a guess.']],
    ['Recover and verify','The admin role is authorized to apply one supplied pool-size correction. Restart only the fictional service; verify endpoint and new logs.',['Apply the authorized lab configuration correction.','Restart the fictional service and inspect its state.','Test endpoint and inspect post-restart log entries.'],['Config state reflects the permitted correction.','Service state changes as expected.','Healthy endpoint and new log evidence prove recovery.']],
  ], prerequisites: [], intro: 'A process is a running program; a service manager controls configured units; journal and application logs have different sources.', explanations: ['Use read-only observations before making changes.','Time-window filtering reduces false correlation.','A successful restart command alone is not a recovery check.'] },
  { track: 'applied-linux', code: 'A06', title: 'Database connections and SQL', subtitle: 'Use a separate practice database for an incident register.', role: 'database learner', workspace: 'database-client', tools: ['psql','CREATE TABLE','INSERT','SELECT','WHERE','COUNT','\\dt','\\d','\\q'], scenarios: [
    ['Connect to the practice database','The exercise provides fictional host, port, database, and credentials. Open the intended database and distinguish connection errors from SQL errors.',['Inspect connection details and intended database name.','Open the simulated PostgreSQL session.','Confirm the connected database and user.'],['All connection fields are identified.','Prompt changes to psql session.','Connection identity matches the practice database.']],
    ['Create and populate a table','Create an incidents table and insert three supplied training records. The practice database is separate from LinuxLab account and progress storage.',['Create the table with required columns.','Insert the supplied practice records.','Inspect the table structure and rows.'],['Table exists only in the exercise database.','Three records are present.','Schema and inserted values are observable.']],
    ['Query and interpret records','Filter incidents by supplied condition and count matching rows. Explain the difference between an operational database and reporting warehouse.',['Filter incidents using the supplied criteria.','Count matching records and inspect returned rows.','Explain what the result supports; mark CBI as unconfirmed.'],['Filter criteria match the exercise.','Count agrees with returned records.','Report does not assume warehouse or CBI is on transaction path.']],
  ], prerequisites: [], intro: 'SQL operates on the isolated practice database. psql meta-commands begin with a backslash; SQL statements end with a semicolon.', explanations: ['A connection issue occurs before SQL execution.','Table and record changes persist within this attempt’s practice database.','A reporting warehouse serves analytics and should not be assumed to be on a live transaction path.'] },
  { track: 'applied-linux', code: 'A07', title: 'Backups and file transfers', subtitle: 'Archive, transfer, and restore evidence without overwriting unrelated data.', role: 'training operator', workspace: 'remote-shell', tools: ['tar','scp','sha256sum','cmp','ls','cat'], scenarios: [
    ['Create the backup','Before maintenance, preserve the specified app and system logs in an archive with the exercise naming convention.',['Select exactly the requested source files.','Create the archive using the required name.','List archive contents and verify selection.'],['Source files are present.','Archive state is created.','Archive contains only intended files.']],
    ['Transfer the backup','Copy the archive to the fictional backup host and compare source and destination checksums.',['Check the destination host and path.','Transfer the archive to the backup host.','Compare SHA-256 checksums.'],['Target host is the supplied training host.','Destination copy exists.','Checksums match.']],
    ['Restore and verify','Restore into a separate recovery directory. Compare recovered files with expected originals without overwriting unrelated files.',['Create or select an isolated recovery directory.','Extract the archive into that directory.','Compare restored contents with expected originals.'],['Recovery path is separate.','All required files were extracted.','Contents match and unrelated files are unchanged.']],
  ], prerequisites: [], intro: 'Archives package files; a transfer copies bytes to a host; checksums compare content. Each operation changes simulated filesystem state.', explanations: ['Check the archive contents before transfer.','A transfer is not validated until destination and checksum are checked.','Restore into a separate directory to avoid accidental overwrite.'] },
  { track: 'applied-linux', code: 'A08', title: 'Shell scripts and scheduling', subtitle: 'Build a reporting script and advance a simulated scheduler.', role: 'training operator', workspace: 'local-shell', tools: ['Bash subset','variables','quotes','pipes','redirection','chmod','bash','crontab'], scenarios: [
    ['Build a reporting script','The on-call team needs a daily report with host, disk, memory, and service state. Build the script with the documented Bash subset.',['Create a script with the required report fields.','Use quoting and redirection safely.','Inspect the generated script contents.'],['Script includes all required fields.','Paths and quoted values are correct.','Script file is saved in the assigned location.']],
    ['Run and troubleshoot the script','The supplied script has a path or execute-permission problem. Diagnose it, correct only the issue, and inspect report output.',['Inspect script path and mode.','Correct the supplied path or permission fault.','Run the script and verify the report values.'],['Failure cause matches observed state.','Only needed permission/path is changed.','Output contains current training data.']],
    ['Schedule and verify','Add the specified schedule with its timezone, then advance the training clock to verify a generated report.',['Create the lab schedule at the supplied time and timezone.','Advance the simulated clock past its next run.','Inspect the scheduler record and generated report.'],['Schedule fields are correct.','Run occurs only after clock advance.','Report reflects the simulated run time and current state.']],
  ], prerequisites: [], intro: 'The shell supports a documented Bash subset only. This scheduler advances with a fictional clock and never runs on the application host.', explanations: ['Scripts are files with executable behavior in a constrained interpreter.','Diagnose path and mode separately.','Timezone is part of the schedule definition; no real cron daemon is used.'] },
  { track: 'applied-linux', code: 'A09', title: 'Docker containers and DDEV projects', subtitle: 'Inspect container state and resolve an alternate project address.', role: 'read-only training investigator', workspace: 'container-dashboard', tools: ['docker ps','docker images','docker inspect','docker logs','ddev list','ddev describe','ddev logs','ddev start/stop/restart'], scenarios: [
    ['Inspect containers','A fictional containerized API is failing. Identify its image, status, restart count, and relevant log evidence.',['List the running and stopped containers.','Inspect the target container and image identity.','Read logs and identify the supplied failure clue.'],['Container selection is exact.','Current container metadata is observed.','Finding references log evidence, not a canned success.']],
    ['Inspect a DDEV project','Project api-sim is running remotely. DDEV reports https://api.training.test:30001 while a teammate uses the old :443 address.',['Use DDEV project listing and description.','Read /var/log/training/ddev-startup.log separately from app logs.','Report current project status and actual URL.'],['Project is read from current simulated state.','Startup record and application log remain distinct.','Handoff identifies actual URL without calling the app stopped.']],
    ['Diagnose the alternate address','Port 443 is occupied by another fictional service. Compare old and DDEV URLs, test each, then document the supported finding and next action.',['Inspect the supplied port conflict and route evidence.','Request the expected and actual project endpoints.','Submit finding with impact, evidence, uncertainty, and approved next step.'],['Port conflict is read from state.','Old address returns 404; actual address returns 200 healthy JSON.','Report does not claim unobserved customer impact.']],
  ], prerequisites: [], intro: 'DDEV manages a local development project and Docker manages containers. Neither is interchangeable with systemctl.', explanations: ['Container identity and logs are independent evidence sources.','A DDEV project can be healthy at an alternate URL.','A returned health response proves only the tested endpoint response, not a later transaction.'], startingState: { mission: 'training-api-alternate-address' } },
  { track: 'applied-linux', code: 'A10', title: 'Printers and print queues', subtitle: 'Configure a virtual queue and preserve unrelated jobs.', role: 'training administrator', workspace: 'printer-dashboard', tools: ['lpinfo','lpadmin','lpstat','lp','cancel'], scenarios: [
    ['Connect a training printer','Inspect the virtual printer catalog. Configure the approved URI only after verifying the catalog entry.',['Inspect the available virtual printer catalog.','Configure lab_printer using the approved training URI.','Verify the queue is enabled and available.'],['Catalog is a virtual dataset.','Queue points to ipp://printer.training.test/ipp/print.','lpstat reflects available queue state.']],
    ['Submit a print job','Submit the supplied report to lab_printer, then inspect the returned job ID and queue.',['Select the intended report and printer.','Submit the virtual print job.','Inspect the job ID, document, destination, and status.'],['Correct report and queue selected.','New job ID is allocated in state.','Queue contains the matching job.']],
    ['Investigate a stuck job','One training job is stuck while another is unrelated. Cancel or correct only the affected job, then verify its lifecycle.',['Inspect queue and identify the stuck job.','Cancel the affected job or apply the permitted correction.','Submit a replacement if required and verify unrelated job remains intact.'],['Affected job is distinguished by ID.','Only intended job changes.','Replacement reaches expected virtual state; unrelated job remains.']],
  ], prerequisites: [], intro: 'Printer discovery, queue changes, and job output are virtual. Nothing is sent to a physical printer.', explanations: ['Configure the approved URI shown by the catalog.','A print command creates a persistent inspectable queue record.','Cancel by job ID after confirming scope.'] },
  { track: 'sre-operations', code: 'B01', title: 'Access, metrics, and baselines', subtitle: 'Establish scope, compare transaction signals, and compute a baseline.', role: 'read-only training investigator', workspace: 'monitoring-dashboard', tools: ['training dashboards','metric definitions','time series','calculator'], scenarios: [
    ['Begin a monitoring shift','Select the fictional account, role, and Region. Three training dashboards show resource and traffic metrics with explicit timezone and freshness.',['Confirm account, role, Region, dashboard, and time zone.','Inspect CPU Average over five minutes and packet-count Sum.','Record memory reading source, active filters, and freshness.'],['Scope metadata is explicit.','Statistic and aggregation period match definitions.','Memory source is named and not presented as a default metric.']],
    ['Investigate a transaction drop','Compare the same time window for WEB-1, WEB-2, and WEB-3. Fixtures include Monday/Wednesday 9 AM and monthly patterns; recurrence is not proof of harmlessness.',['Compare attempts, successes, failures, and logs for same window.','Calculate the supplied drop/success rate.','Distinguish reduced demand, failed processing, and missing reporting.'],['Resources and time windows align.','Calculation is correct.','Conclusion reflects data completeness and actual failures.']],
    ['Calculate a baseline and buffer','Use comparable historical periods and statistics. Explain missing samples and the limits of a three-month comparison.',['Select comparable resources, periods, and statistic.','Calculate a baseline from available samples.','Distinguish percentage-point buffer from relative percentage and note gaps.'],['Dataset selection is defensible.','Baseline arithmetic is correct.','Missing samples/resolution are explicitly reported.']],
  ], prerequisites: [], intro: 'Metric values depend on resource, statistic, period, timezone, filters, and source. The three dashboard names and datasets are fictional training fixtures.', explanations: ['Five-minute CPU Average and packet Sum apply only where the definition says so.','A repeating pattern can still indicate failure.','A baseline should use comparable data; a three-month label does not repair missing samples.'] },
  { track: 'sre-operations', code: 'B02', title: 'Alarms, escalation, and incident reporting', subtitle: 'Evaluate alarm state and create evidence-backed handovers.', role: 'on-call trainee', workspace: 'monitoring-dashboard', tools: ['alarm evaluator','notification timeline','incident report editor','CSV export'], scenarios: [
    ['Interpret an alarm','Evaluate a supplied datapoint sequence using metric, statistic, period, threshold, evaluation count, datapoints-to-alarm, and missing-data treatment.',['Inspect all alarm configuration fields.','Evaluate supplied points against the alarm settings.','Explain whether state is OK, ALARM, or INSUFFICIENT_DATA.'],['Configuration is fully recorded.','State follows configured evaluation.','Explanation addresses missing data.']],
    ['Correlate alarms and service impact','A composite rule and repeated notifications refer to a single service issue. Keep cloud alarm states separate from fictional Normal/Cautious/Serious labels.',['Inspect composite rule and service evidence.','Group repeated notifications that refer to the same incident.','State any explicit mapping used between status vocabularies.'],['Alarm, notification, and incident are separated.','Duplicate notices are not counted as separate incidents.','No verified company mapping is implied.']],
    ['Report and hand over','Prepare a report with time/timezone, resource, alarm, metric readings, impact, evidence, actions, owner, recovery, and next step; export CSV.',['Build a timeline from metrics, logs, and notifications.','Complete structured incident fields and escalation owner.','Export copyable report and CSV; note three-hour reporting cadence.'],['Timeline order and timezone are clear.','Report facts link to supplied evidence.','Urgent response is not delayed for the reporting interval.']],
  ], prerequisites: [], intro: 'This lab uses CloudWatch-like alarm evaluation and separately labeled training status. Squadcast-style routing is fictional context, not a confirmed integration.', explanations: ['Alarm state depends on its complete evaluation configuration.','A notification is not itself a unique incident.','Three-hour reporting is an update cadence, not a wait-before-response rule.'] },
  { track: 'sre-operations', code: 'B03', title: 'Request tracing, routing, and API simulators', subtitle: 'Trace fictional request paths and diagnose routing evidence.', role: 'read-only training investigator', workspace: 'monitoring-dashboard', tools: ['trace viewer','routing dashboard','DNS/TLS evidence','curl'], scenarios: [
    ['Trace a request across services','Follow one correlation ID through a fictional kiosk, API Core, and ECS-hosted QR service. Missing evidence must remain missing; a QR response does not prove cash-in completion.',['Inspect timestamps and outbound calls for the correlation ID.','Compare responses and missing stage entries.','Explain proven request stages and flag AFOD/GW2/ECPay names for confirmation.'],['Correlation ID remains consistent.','Evidence path and gap are identified.','No unobserved transaction completion is claimed.']],
    ['Diagnose incorrect routing','Training CloudFront behaviors include /invoice/1/*, /invoice/21/*, and /invoice/*. Inspect ordering and distinguish downstream load-balancer routing.',['Inspect behavior order, origin, query/header forwarding, and cache settings.','Match supplied request paths to selected behavior.','Identify the ordering defect without claiming path rules inspect bodies.'],['Specific paths and general path are distinguished.','Behavior selection is reproducible.','Downstream route and cache are reported separately.']],
    ['Investigate a proxy or simulator endpoint','Compare fictional client URL, DNS, proxy map, TLS certificate, and backend response; use the controlled restart timeline.',['Separate URL hostname from path and inspect name resolution.','Inspect TLS termination, proxy mapping, and backend response.','Explain component roles and distinguish QR response from later completion.'],['Hostname and path are interpreted correctly.','Route and certificate evidence agree with result.','Web/API/cache/worker roles are not invented from ambiguous notes.']],
  ], prerequisites: [], intro: 'The trace and route data are training fixtures. AFOD, GW2, ECPay, DPU, MPI proxy, and similar terms are not assigned meanings unless confirmed by supplied evidence.', explanations: ['Trace presence supports only the stages with records.','CloudFront path matching does not inspect request-body fields.','A QR response is not proof of downstream payment completion.'] },
  { track: 'sre-operations', code: 'B04', title: 'Vulnerability findings and security events', subtitle: 'Separate raw security evidence from interpretation and confidence.', role: 'security operations trainee', workspace: 'monitoring-dashboard', tools: ['findings dashboard','event viewer','decoder/rule panel','report editor'], scenarios: [
    ['Review a vulnerability finding','Inspect fictional Inspector-style EC2, ECR, and Lambda findings with package, version, severity, scan time, coverage, fix, and owner.',['Compare resource type and identity.','Record package/version/severity/scan time/coverage/recommended fix.','Identify fictional owner and explain what finding alone does not prove.'],['Resource scope is exact.','Coverage and recommendation are captured.','A vulnerability finding is not described as exploitation.']],
    ['Understand a Wazuh-style event','Follow a raw event through collection, decoder, matching rule, endpoint, severity, storage, and display.',['Read the raw event and extracted fields.','Identify decoder/rule and endpoint/time.','Separate raw facts from rule-assigned interpretation.'],['Raw fields are preserved.','Rule and decoder are correctly linked.','Interpretation is not represented as raw evidence.']],
    ['Investigate suspicious sign-ins','Group supplied events by user/source/endpoint and compare later success with authorized support records. Similar-looking events may be unrelated.',['Filter the supplied time window.','Group failures and inspect later successful logins.','Submit confidence, evidence, and next action without unsupported compromise claims.'],['Time filter is correct.','Events are grouped with source context.','Confidence follows evidence; “not confirmed” is valid.']],
  ], prerequisites: [], intro: 'Security findings and event rules are fictional training records. An empty findings view does not establish scan coverage.', explanations: ['A finding indicates a reported condition, not exploitation.','A rule is an interpretation attached to raw event data.','Investigate similar-looking events independently and state confidence.'] },
  { track: 'sre-operations', code: 'B05', title: 'Images, scaling, and change verification', subtitle: 'Compare image, deployment, running state, and rollout evidence.', role: 'read-only release investigator', workspace: 'monitoring-dashboard', tools: ['deployment records','ECS task panel','request dataset','Kubernetes comparison','rollout report'], scenarios: [
    ['Distinguish configuration and image layers','Inspect fictional AMI, container image, launch template, task definition, and running-version records. Determine which resources change after an update.',['Compare image and configuration identities across layers.','Trace the proposed update to resources that consume it.','Explain new launches versus existing running resources.'],['Each layer has a distinct identity.','Change impact follows references in the fixture.','Existing workloads are not assumed to update from registry push alone.']],
    ['Assess scaling and prepared test data','Use the defined fictional task naming scheme, request array, and rate ceiling. Compare sent, gateway-arrived, and successful requests.',['Inspect desired/running ECS counts and rate ceiling.','Compare request IDs across sent, gateway, and response arrays.','Explain task capacity versus partner limits and end-to-end success; contrast K8s terms.'],['ECS desired/running state is recorded.','Counts follow the supplied data arrays.','ECS and Kubernetes control planes remain distinct.']],
    ['Verify a rollout and hand over','Compare registry image, deployed task definition, and running versions. The fictional script workload trigger is an explicitly supplied event rule.',['Compare image registry, task definition, and live task versions.','Check health, logs, and metrics for stale or incomplete adoption.','Document verified rollout, remaining work, and the stated script trigger.'],['All versions are compared.','Health evidence supports the rollout status.','Registry update is not mistaken for running deployment; trigger is stated.']],
  ], prerequisites: [], intro: 'AMI, image, task definition, and running workload are separate layers. The exercise’s scaling names and rate ceiling are fictional, not organizational policy.', explanations: ['Changing a registry tag does not change existing running tasks.','More tasks do not remove a partner request ceiling or prove request success.','Verify actual running versions and report remaining adoption work.'] },
];

function taskHints(title, tool, taskIndex, scenarioText = '') {
  const command = String(tool).split(/\s+/)[0];
  const scenarioPath = scenarioText.match(/\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*/)?.[0];
  const examples = {
    ls: `ls ${scenarioPath || '/the/path/from-this-scenario'}`,
    cd: `cd ${scenarioPath || 'the-directory-from-this-scenario'}`,
    cat: `cat ${scenarioPath || '/the/config-or-log-from-this-scenario'}`,
    head: `head -n 3 ${scenarioPath || '/the-file-from-this-scenario'}`,
    grep: `grep "ERROR" ${scenarioPath || '/the-log-from-this-scenario'}`,
    cp: `cp ${scenarioPath || 'SOURCE'} ${scenarioPath ? `${scenarioPath}.bak` : 'BACKUP'}`,
    jq: `jq -r .port ${scenarioPath || '/the-config-from-this-scenario'}`,
    editor: `editor set ${scenarioPath || '/the-config-from-this-scenario'} .KEY VALUE`,
    curl: `curl ${scenarioText.match(/https?:\/\/[^\s.,]+/)?.[0] || 'https://the-scenario-endpoint'}`,
    systemctl: `systemctl status ${scenarioText.match(/(?:service|unit)\s+["']?([a-z][a-z0-9-]+)/i)?.[1] || 'SERVICE'}`,
    chmod: `chmod 0640 ${scenarioPath || 'REPORT_FILE'}`,
    chgrp: `chgrp GROUP ${scenarioPath || 'REPORT_FILE'}`,
    sudo: 'sudo -u USER cat FILE',
    echo: 'echo "state the observed result and cite the evidence"',
    ps: 'ps aux',
    top: 'top',
    free: 'free -h',
    df: 'df -h',
    getent: 'getent hosts api.training.test',
    ip: 'ip addr',
    ss: 'ss -ltn',
    ssh: 'ssh USER@HOST',
    tar: /extract|restore/i.test(title) ? 'tar -xzf training-logs-2026-11-22.tar.gz -C /srv/recovery' : /create|archive/i.test(title) ? 'tar -czf training-logs-2026-11-22.tar.gz /var/log/training/app.log /var/log/training/system.log' : 'tar -tzf training-logs-2026-11-22.tar.gz',
    scp: /transfer|copy/i.test(title) ? 'scp training-logs-2026-11-22.tar.gz learner@backup-01.training.test:/srv/backups/' : 'scp learner@backup-01.training.test:/srv/backups/training-logs-2026-11-22.tar.gz /tmp/backup-copy.tar.gz',
    sha256sum: /restor|contents/i.test(title) ? 'sha256sum /srv/recovery/var/log/training/app.log /var/log/training/app.log' : 'sha256sum training-logs-2026-11-22.tar.gz /tmp/backup-copy.tar.gz',
    mkdir: 'mkdir -p /srv/recovery/var/log/training',
    docker: /inspect/i.test(title) ? 'docker inspect api-sim-web' : /log/i.test(title) ? 'docker logs api-sim-web' : 'docker ps -a',
    ddev: /log/i.test(title) ? 'ddev logs api-sim' : /describe|address|status/i.test(title) ? 'ddev describe api-sim' : 'ddev list',
    whoami: 'whoami',
    id: 'id USER',
    'scope selector': 'choose linuxlab-training / MetricsReadOnly / training-west-1 / UTC',
    'dashboard tabs': 'open all three named training dashboards',
    'metric inspector': 'CPU Average 5m; packet counters Sum 5m; memory from training-agent',
    'freshness panel': 'inspect each dashboard source and freshest sample',
    'comparison controls': 'compare WEB-1, WEB-2, WEB-3 in one UTC window',
    'rate calculator': 'successes / attempts and failures / attempts',
    'analysis editor': 'report reduced demand, failed processing, and missing reporting',
    'historical baseline panel': 'WEB-1 · 90d · Average · 15d buckets',
    'buffer calculator': '42% + 5 percentage points vs 5% relative',
    'report editor': 'note gaps, sample resolution, and both buffer meanings',
    'alarm evaluator': 'open the alarm panel, inspect its rule, then evaluate the visible datapoints',
    'notification timeline': 'open the composite alarm and service evidence, then group the notices by incident ID',
    'incident report editor': 'build the UTC evidence timeline, fill every required field, and save the report',
    'CSV export': 'save the report first, export it, then add a handover note with cadence and uncertainty',
    'findings dashboard': 'inspect EC2, ECR, and Lambda records; compare scan time, coverage, and suggested fixes',
    'event viewer': 'open the raw edge-07 event, then compare the extracted fields',
    'decoder/rule panel': 'trace the raw event through decoder, rule, collection, and storage',
    'sign-in filter': 'set the supplied window to 09:00–10:00 UTC',
    'sign-in grouping': 'group by user, source address, and endpoint before assessing intent',
    'deployment records': 'compare the AMI, launch template, registry image, task definition, and running tasks',
    'ECS task panel': 'record desired and running counts plus the stated request rate ceiling',
    'request dataset': 'compare the prepared sent, gateway, and response ID arrays',
    'Kubernetes comparison': 'keep ECS tasks distinct from Pods, nodes, and replicas',
    'rollout report': 'compare registry and definition to every running version, health response, log, and metric',
    openssl: 'openssl s_client -connect api.training.test:443 -servername api.training.test',
    waf: 'waf inspect',
  };
  return [
    `For “${title.toLowerCase()},” identify the source, time window, and result you need to observe before changing anything.`,
    `Use ${tool} to inspect the relevant scenario state and collect evidence for this task.`,
    `Example: ${examples[String(tool).toLowerCase()] || examples[command] || `${tool} <the resource named in this scenario>`}`,
  ];
}

const hintTools = {
  A01: [['ls','cat','echo'],['cp','editor','jq'],['systemctl','curl','echo']],
  A02: [['whoami','ls','echo'],['chgrp','ls','chmod'],['sudo','sudo','echo']],
  A03: [['cat','ssh','hostname'],['hostname','cat','echo'],['echo','ls','cat']],
  A04: [['getent','ip','echo'],['ss','cat','echo']],
  A05: [['systemctl','ps','echo'],['cat','grep','echo'],['editor','systemctl','echo']],
  A06: [['cat','psql','echo'],['CREATE TABLE','INSERT','\\d'],['SELECT','COUNT','echo']],
  A07: [['cat','tar','tar'],['cat','scp','sha256sum'],['mkdir','tar','sha256sum']],
  A08: [['printf','bash','cat'],['ls','chmod','bash'],['crontab','training-clock','cat']],
  A09: [['docker','docker','docker'],['ddev','ddev','cat'],['ss','curl','echo']],
  A10: [['lpinfo','lpadmin','lpstat'],['cat','lp','lpstat'],['lpstat','cancel','lp']],
  B01: [['scope selector','dashboard tabs','metric inspector'],['comparison controls','rate calculator','analysis editor'],['historical baseline panel','buffer calculator','report editor']],
  B02: [['alarm evaluator','alarm evaluator','alarm evaluator'],['notification timeline','notification timeline','notification timeline'],['UTC timeline','incident report editor','CSV export']],
  B03: [['trace viewer','trace viewer','trace viewer'],['routing dashboard','routing dashboard','routing dashboard'],['DNS/TLS evidence','proxy test','curl']],
  B04: [['findings dashboard','findings dashboard','findings dashboard'],['event viewer','decoder/rule panel','decoder/rule panel'],['sign-in filter','sign-in grouping','report editor']],
  B05: [['deployment records','deployment records','deployment records'],['ECS task panel','request dataset','Kubernetes comparison'],['rollout report','rollout report','rollout report']],
  A04: [['getent','ip','echo'],['ss','cat','echo'],['openssl','waf','echo']],
};

function monitoringScenarioState() {
  return {
    monitoring: {
      scopeOptions: { account: 'linuxlab-training', role: 'MetricsReadOnly', region: 'training-west-1', timezone: 'UTC' },
      scope: null,
      dashboards: [
        { id: 'fleet', name: 'Training Fleet Overview', source: 'Training metrics fixture', freshness: '2026-11-22T09:00:00Z' },
        { id: 'traffic', name: 'Training Request Signals', source: 'Training gateway fixture', freshness: '2026-11-22T09:00:00Z' },
        { id: 'history', name: 'Training Host Memory (fictional)', source: 'training-agent custom metric fixture', freshness: '2026-11-22T09:00:00Z' },
      ],
      openedDashboards: [],
      selection: { resource: 'WEB-1', window: 'current-5m', timezone: 'UTC' },
      metrics: {
        CPUUtilization: { unit: '%', statistic: 'Average', period: '5m', values: { 'WEB-1': 42, 'WEB-2': 55, 'WEB-3': 37 }, source: 'Training host telemetry fixture' },
        NetworkPacketsIn: { unit: 'packets', statistic: 'Sum', period: '5m', values: { 'WEB-1': 12840, 'WEB-2': 16320, 'WEB-3': 10990 }, source: 'Training network counter fixture' },
        NetworkPacketsOut: { unit: 'packets', statistic: 'Sum', period: '5m', values: { 'WEB-1': 9420, 'WEB-2': 12080, 'WEB-3': 8370 }, source: 'Training network counter fixture' },
        MemoryUsed: { unit: 'MiB', statistic: 'Average', period: '5m', values: { 'WEB-1': 6144, 'WEB-2': 7168, 'WEB-3': 5632 }, source: 'training-agent custom metric fixture; not a default host metric' },
      },
      requestWindows: {
        'monday-09': [
          { resource: 'WEB-1', attempts: 1000, successes: 900, failures: 100, logSamples: 1000 },
          { resource: 'WEB-2', attempts: 900, successes: 855, failures: 45, logSamples: 900 },
          { resource: 'WEB-3', attempts: 1100, successes: 770, failures: 330, logSamples: 1100 },
        ],
        'wednesday-09': [
          { resource: 'WEB-1', attempts: 400, successes: 396, failures: 4, logSamples: 400 },
          { resource: 'WEB-2', attempts: 420, successes: 416, failures: 4, logSamples: 420 },
          { resource: 'WEB-3', attempts: 380, successes: 370, failures: 10, logSamples: 380 },
        ],
        monthly: [
          { resource: 'WEB-1', attempts: 28000, successes: 27000, failures: 1000, logSamples: 28000 },
          { resource: 'WEB-2', attempts: 26000, successes: 25100, failures: 900, logSamples: 26000 },
          { resource: 'WEB-3', attempts: 27000, successes: 25000, failures: 2000, logSamples: null },
        ],
      },
      historical: {
        window: '90d',
        period: '15d',
        expectedSamples: 6,
        statistic: 'Average',
        values: {
          'WEB-1': [40, 42, 44, null, 43, 41],
          'WEB-2': [52, 54, 53, 55, null, 56],
          'WEB-3': [35, 36, 38, 37, 39, 40],
        },
      },
      inspections: [],
      comparison: null,
      comparisonHistory: {},
      calculation: null,
      baseline: null,
      buffer: null,
      submittedNote: '',
    },
  };
}

function scenarioState(unit, lessonIndex) {
  if (unit.code === 'B01') return monitoringScenarioState();
  if (unit.code === 'B02') return {
    incident: {
      alarm: {
        name: 'WEB-3-CPU-high', resource: 'WEB-3', metric: 'CPUUtilization', statistic: 'Average',
        periodSeconds: 300, threshold: 70, comparison: 'greater-than-or-equal',
        evaluationPeriods: 3, datapointsToAlarm: 2, missingDataTreatment: 'notBreaching',
        points: [
          { time: '2026-11-22T09:00:00Z', value: 71 },
          { time: '2026-11-22T09:05:00Z', value: null },
          { time: '2026-11-22T09:10:00Z', value: 74 },
        ],
      },
      alarmInspected: false,
      evaluation: null,
      notifications: [
        { id: 'notice-701', incidentId: 'INC-704', alarm: 'WEB-3-CPU-high', time: '2026-11-22T09:11:00Z', channel: 'training-pager' },
        { id: 'notice-702', incidentId: 'INC-704', alarm: 'WEB-3-CPU-high', time: '2026-11-22T09:12:00Z', channel: 'training-email' },
        { id: 'notice-703', incidentId: 'INC-705', alarm: 'WEB-3-CPU-high', time: '2026-11-22T09:18:00Z', channel: 'training-pager' },
      ],
      compositeRule: { name: 'Training-Web-Impact', expression: 'WEB-3-CPU-high AND service-check-failed', source: 'fictional alarm rule' },
      serviceEvidence: { service: 'training-web', state: 'degraded', observedAt: '2026-11-22T09:13:00Z', evidence: 'health checks failed 2 of 3; request errors 12/100' },
      serviceInspected: false,
      compositeInspected: false,
      groupedNotifications: null,
      submittedNote: '',
      statusLabels: ['Normal', 'Cautious', 'Serious'],
      timelineEvents: [
        { time: '2026-11-22T09:00:00Z', type: 'metric', resource: 'WEB-3', detail: 'CPUUtilization 71%' },
        { time: '2026-11-22T09:05:00Z', type: 'metric', resource: 'WEB-3', detail: 'CPU datapoint missing' },
        { time: '2026-11-22T09:10:00Z', type: 'metric', resource: 'WEB-3', detail: 'CPUUtilization 74%' },
        { time: '2026-11-22T09:11:00Z', type: 'notification', resource: 'INC-704', detail: 'Training pager notification' },
        { time: '2026-11-22T09:12:00Z', type: 'log', resource: 'training-web', detail: 'Health checks failing 2 of 3' },
        { time: '2026-11-22T09:13:00Z', type: 'service', resource: 'training-web', detail: 'Service state observed degraded' },
        { time: '2026-11-22T09:18:00Z', type: 'notification', resource: 'INC-705', detail: 'Separate training incident notice' },
      ],
      timeline: null,
      reportFields: {
        timeAndTimezone: '', resource: '', alarmAndMetric: '', impact: '', evidence: '',
        actions: '', escalationAndOwner: '', recovery: '', nextAction: '',
      },
      reportSaved: false,
      reportText: '',
      reportCsv: '',
      handoverNote: '',
    },
  };
  if (unit.code === 'B03') return {
    requestLab: {
      trace: { events: [
        { time: '2026-11-22T10:01:00Z', correlationId: 'REQ-7F21', service: 'Kiosk UI', kind: 'outbound request', detail: 'POST /qr/issue to API Core; reference GW2-8841' },
        { time: '2026-11-22T10:01:02Z', correlationId: 'REQ-7F21', service: 'API Core', kind: 'outbound call', detail: 'GET /v1/qr on ECS QR service; AFOD route tag present' },
        { time: '2026-11-22T10:01:03Z', correlationId: 'REQ-7F21', service: 'QR Service', kind: 'response', detail: 'HTTP 200; QR payload returned; ECPay reference GW2-8841' },
      ], missingStage: 'No settlement or cash-in completion event in this trace' },
      traceInspected: false,
      traceNote: '',
      routing: {
        behaviors: [
          { pattern: '/invoice/*', origin: 'invoice-general.training.test', forwardHeaders: ['Host'], forwardQuery: false, cachePolicy: 'cache-invoice-5m' },
          { pattern: '/invoice/1/*', origin: 'invoice-client-1.training.test', forwardHeaders: ['Host', 'X-Client-Code'], forwardQuery: true, cachePolicy: 'no-cache' },
          { pattern: '/invoice/21/*', origin: 'invoice-client-21.training.test', forwardHeaders: ['Host', 'X-Client-Code'], forwardQuery: true, cachePolicy: 'no-cache' },
        ],
        loadBalancer: 'invoice-alb.training.internal; routes by forwarded X-Client-Code header',
        tests: {},
      },
      routingInspected: false,
      routingNote: '',
      proxy: {
        clientUrl: 'https://api-client.training.test/v1/qr',
        dns: { hostname: 'api-client.training.test', address: '192.0.2.44' },
        tls: { terminator: 'Training edge proxy', names: ['api.training.test'], valid: false },
        mapping: { host: 'api-client.training.test', port: 8443, backend: 'qr-old.training.internal' },
        backend: { name: 'QR simulator', status: 200, qrResponse: 'QR-TRAINING-7F21', cashInCompletion: 'not present in simulator response' },
        restartCount: 0,
        restartTimeline: [],
      },
      proxyInspected: false,
      proxyNote: '',
      lastTest: null,
    },
  };
  if (unit.code === 'B04') return {
    security: {
      findings: [
        { id: 'FND-EC2-41', resourceType: 'EC2', resource: 'i-0train41', package: 'openssl', installedVersion: '3.0.11-r0', severity: 'HIGH', scanTime: '2026-11-22T08:40:00Z', coverage: 'completed; agent heartbeat 08:39Z', suggestedFix: 'upgrade to 3.0.13-r0', owner: 'training-platform' },
        { id: 'FND-ECR-17', resourceType: 'ECR', resource: 'linuxlab/api:1.8', package: 'libxml2', installedVersion: '2.11.5-r1', severity: 'MEDIUM', scanTime: '2026-11-22T08:42:00Z', coverage: 'completed; image digest sha256:train17', suggestedFix: 'rebuild image with 2.11.7-r0', owner: 'training-containers' },
        { id: 'FND-LAMBDA-09', resourceType: 'Lambda', resource: 'training-receipt-worker', package: 'requests', installedVersion: '2.31.0', severity: 'LOW', scanTime: '2026-11-22T08:45:00Z', coverage: 'partial; one layer not scanned', suggestedFix: 'update dependency to 2.32.0 and rescan', owner: 'training-payments' },
      ],
      findingsInspected: false,
      findingsNote: '',
      event: {
        raw: { timestamp: '2026-11-22T09:16:22Z', agent: 'edge-07', event_id: 4625, srcip: '198.51.100.24', user: 'mrivera', message: 'authentication failure for invalid user mrivera from 198.51.100.24' },
        extracted: { sourceIp: '198.51.100.24', username: 'mrivera', eventId: 4625, authenticationResult: 'failure' },
        decoder: 'sshd-training',
        rule: { id: '5710', severity: 'medium', description: 'multiple authentication failures from source' },
        endpoint: 'edge-07',
        time: '2026-11-22T09:16:22Z',
        flow: ['collection agent', 'analysis engine', 'event index', 'dashboard display'],
      },
      eventInspected: false,
      eventNote: '',
      signIns: [
        { time: '2026-11-22T09:10:03Z', user: 'mrivera', source: '198.51.100.24', endpoint: 'edge-07', result: 'failure', context: 'password rejected', authorizedSupport: false },
        { time: '2026-11-22T09:12:08Z', user: 'mrivera', source: '198.51.100.24', endpoint: 'edge-07', result: 'failure', context: 'password rejected', authorizedSupport: false },
        { time: '2026-11-22T09:16:22Z', user: 'mrivera', source: '198.51.100.24', endpoint: 'edge-07', result: 'failure', context: 'rule 5710', authorizedSupport: false },
        { time: '2026-11-22T09:31:17Z', user: 'mrivera', source: '198.51.100.24', endpoint: 'edge-07', result: 'success', context: 'authorized support ticket HD-2291', authorizedSupport: true },
        { time: '2026-11-22T09:44:02Z', user: 'svc-reports', source: '10.20.4.18', endpoint: 'worker-02', result: 'success', context: 'scheduled service login', authorizedSupport: true },
        { time: '2026-11-22T10:07:00Z', user: 'mrivera', source: '198.51.100.24', endpoint: 'edge-07', result: 'failure', context: 'outside requested window', authorizedSupport: false },
      ],
      signInWindow: null,
      filteredSignins: null,
      signInGroups: null,
      signInNote: '',
    },
  };
  if (unit.code === 'B05') return {
    deployment: {
      ami: { id: 'ami-train-2026.11', configRevision: 'bootstrap-r8' },
      registry: { image: 'linuxlab/api:1.8', digest: 'sha256:train-18' },
      launchTemplate: { id: 'lt-training-22', amiId: 'ami-train-2026.11', configRevision: 'bootstrap-r8' },
      taskDefinition: { image: 'linuxlab/api:1.8', revision: 42, configRevision: 'api-config-r12' },
      runningTasks: [
        { id: 'task-16', image: 'linuxlab/api:1.8', configRevision: 'api-config-r12', status: 'running' },
        { id: 'task-17', image: 'linuxlab/api:1.8', configRevision: 'api-config-r12', status: 'running' },
      ],
      layersInspected: false,
      published: false,
      layerNote: '',
      scaling: {
        cluster: 'training-east-1', taskFamily: 'api-sim', desired: 4, running: 3,
        partnerRateCeiling: 120,
        namingConvention: 'REQ-TYYMMDD-NN; IDs are a fictional prepared test batch',
        requests: {
          sent: ['REQ-T261122-01','REQ-T261122-02','REQ-T261122-03','REQ-T261122-04','REQ-T261122-05','REQ-T261122-06'],
          gateway: ['REQ-T261122-01','REQ-T261122-02','REQ-T261122-03','REQ-T261122-05','REQ-T261122-06'],
          responses: [
            { id: 'REQ-T261122-01', status: 200 }, { id: 'REQ-T261122-02', status: 200 },
            { id: 'REQ-T261122-03', status: 429 }, { id: 'REQ-T261122-05', status: 200 },
          ],
        },
        inspected: false, comparison: null, note: '',
      },
      rollout: {
        registryImage: 'linuxlab/api:2.2', taskDefinitionImage: 'linuxlab/api:2.2', taskDefinitionRevision: 61,
        runningVersions: [
          { id: 'task-16', image: 'linuxlab/api:2.2', health: 'healthy' },
          { id: 'task-17', image: 'linuxlab/api:2.1', health: 'degraded' },
        ],
        healthResponses: [
          { time: '2026-11-22T11:01:00Z', path: '/health', status: 200 },
          { time: '2026-11-22T11:03:00Z', path: '/health', status: 502 },
        ],
        log: '2026-11-22T11:02:47Z ERROR task-17 upstream timeout after image 2.1',
        metric: '5xx rate 4.8% (training threshold 1.0%)',
        script: { path: '/opt/training/reconcile-release.sh', trigger: 'EventBridge rule training-release-watch on image-push event', lastEvent: '2026-11-22T10:58:00Z image-push api:2.2' },
        inspected: false, verification: null, handover: '',
      },
    },
  };
  if (unit.code === 'A01') {
    const port = lessonIndex === 2 ? 8081 : 8080;
    return {
      role: lessonIndex === 1 || lessonIndex === 2 ? 'training-admin' : 'learner',
      services: { 'training-api': lessonIndex === 2 ? 'active (running)' : 'active (running)' },
      endpoints: lessonIndex === 2 ? { 'https://api.training.test:8081/health': { status: 200, body: '{"status":"healthy","service":"training-api"}' } } : {},
      files: {
        '/opt/training-api/config.json': { type: 'file', content: `{
  "name": "training-api",
  "port": ${port},
  "healthPath": "/health"
}` },
        '/opt/training-api/README.txt': { type: 'file', content: 'Runbook: training client expects https://api.training.test:8081/health\nOwner: training-platform' },
        ...(lessonIndex === 2 ? { '/var/log/training-api/app.log': { type: 'file', content: '2026-11-22T09:00:00Z INFO service started on port 8081\n2026-11-22T09:00:01Z INFO health check passed status=200' } } : {}),
      },
    };
  }
  if (unit.code === 'A02') return {
    role: lessonIndex === 0 ? 'learner' : 'training-admin',
    users: { learner: { groups: ['learners'] }, 'report-reader': { groups: ['report-users'] }, 'guest-audit': { groups: ['auditors'] } },
    groups: ['learners','report-users','auditors','finance-ops'],
    files: { '/srv/reports/monthly.csv': { type: 'file', content: 'month,total\n2026-10,418\n', owner: 'finance-admin', group: lessonIndex === 2 ? 'report-users' : 'finance-ops', mode: '0640' } },
  };
  if (unit.code === 'A03') {
    const localFiles = { '/home/learner/connection.txt': { type: 'file', content: 'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01' } };
    const remote = { host: 'lab-app-01', user: 'learner', fingerprint: 'SHA256:TRAINING-ONLY-01', cwd: '/home/learner', files: {
      '/home/learner/connection.txt': { type: 'file', content: 'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01' },
      '/opt/training-api/config.json': { type: 'file', content: '{\n  "name": "training-api",\n  "port": 8080\n}' },
    } };
    const common = {
      localHost: 'learner-pc',
      hostFingerprints: { 'lab-app-01.training.test': remote.fingerprint },
      ...(lessonIndex === 2 ? { knownHosts: { 'lab-app-01.training.test': remote.fingerprint } } : {}),
      hosts: { 'lab-app-01.training.test': remote },
    };
    if (lessonIndex === 2) return {
      ...common, host: remote.host, user: remote.user, cwd: remote.cwd, files: remote.files,
      remoteSession: { key: 'lab-app-01.training.test' },
      localSession: { host: 'learner-pc', user: 'learner', cwd: '/home/learner', oldpwd: '/home/learner', files: { ...localFiles } },
    };
    return { ...common, host: 'learner-pc', files: localFiles };
  }
  if (unit.code === 'A04') {
    const files = lessonIndex === 0
      ? { '/etc/training/client-destination.txt': { type: 'file', content: 'Client record: api.training.test -> 10.24.1.31\nApproved network: 10.24.1.0/24' } }
      : { '/etc/training/port-map.txt': { type: 'file', content: 'API listener: 8443\nClient requested port: 443\nTLS terminates at: training edge' } };
    const network = {
      interfaces: [{ name: 'eth0', address: '10.24.1.18/24', state: 'UP' }],
      routes: [{ destination: 'default', via: '10.24.1.1', device: 'eth0' }],
      dns: { 'api.training.test': '10.24.1.30' },
    };
    if (lessonIndex === 2) Object.assign(network, {
      tls: {
        terminator: 'training edge proxy',
        certificate: { subject: 'CN=api.training.test', names: ['api.training.test'], notBefore: '2026-10-01T00:00:00Z', notAfter: '2027-10-01T00:00:00Z', valid: true, protocol: 'TLSv1.3' },
      },
      waf: {
        id: 'WAF-TRAIN-8821', time: '2026-11-22T10:22:18Z', sourceAddress: '10.24.8.12',
        forwardedFor: '198.51.100.24', allowlist: '198.51.100.0/24', proxy: 'edge-proxy-02 (10.24.8.12)',
        forwardedHeaderTrust: 'not confirmed by supplied configuration',
      },
    });
    if (lessonIndex === 1) Object.assign(network, {
      listeners: [
        { address: '0.0.0.0', port: 443, process: 'legacy-site' },
        { address: '0.0.0.0', port: 8443, process: 'training-api' },
      ],
      endpointChecks: [],
    });
    return {
      host: 'network-lab', role: 'read-only investigator', network,
      endpoints: lessonIndex === 1 ? {
        'https://api.training.test:443/health': { status: 404, body: '{"httpStatus":404,"error":"wrong virtual service"}' },
        'https://api.training.test:8443/health': { status: 200, body: '{"httpStatus":200,"status":"healthy","service":"training-api"}' },
      } : {},
      files,
    };
  }
  if (unit.code === 'A05') {
    const recoveryLesson = lessonIndex === 2;
    const config = { service: 'training-site', poolSize: recoveryLesson ? 10 : 10, endpoint: 'https://status.training.test/health' };
    const log = [
      '2026-11-22T09:00:00Z INFO training-site startup complete',
      '2026-11-22T09:02:00Z WARN database pool utilization=90%',
      '2026-11-22T09:04:12Z ERROR database connection pool exhausted active=10 max=10',
      '2026-11-22T09:05:01Z ERROR request failed status=503',
      '2026-11-22T09:07:00Z INFO health probe status=503',
    ].join('\n');
    return {
      role: recoveryLesson ? 'training-admin' : 'read-only investigator',
      host: 'web-1',
      services: { 'training-site': 'failed (Result: connection pool exhausted)' },
      processes: [
        { pid: 1, user: 'root', cpu: 0.1, mem: 0.4, command: 'init' },
        { pid: 812, user: 'www-data', cpu: 4.2, mem: 31.5, command: 'node training-site' },
        { pid: 913, user: 'app', cpu: 72.4, mem: 22.1, command: 'db-worker --pool 10' },
      ],
      disk: { total: 20, used: 15.2, available: 4.8 },
      memory: { total: 8192, used: 6144, free: 2048 },
      serviceLogs: { 'training-site': log },
      endpoints: { 'https://status.training.test/health': { status: 503, body: '{"httpStatus":503,"status":"unavailable","reason":"connection pool exhausted"}' } },
      files: {
        '/opt/training-site/config.json': { type: 'file', content: JSON.stringify(config, null, 2) },
        '/var/log/training/training-site.log': { type: 'file', content: log },
      },
    };
  }
  if (unit.code === 'A06') return {
    databaseConfig: { host: 'db.training.test', port: 5432, user: 'trainee', database: 'incidents_lab' },
    practiceDatabases: { incidents_lab: { tables: {} } },
    files: { '/home/learner/db-connection.txt': { type: 'file', content: 'Host: db.training.test\nPort: 5432\nDatabase: incidents_lab\nUser: trainee\nPassword: TRAINING-ONLY (fictional)' } },
    reportingEvidence: { warehouse: 'training-reporting-warehouse', refresh: 'hourly', transactionPathConfirmed: false },
  };
  if (unit.code === 'A07') {
    const host = 'backup-01.training.test';
    const remote = { host: 'backup-01', user: 'learner', fingerprint: 'SHA256:BACKUP-TRAINING-01', cwd: '/home/learner', files: { '/home/learner': { type: 'dir' }, '/srv': { type: 'dir' }, '/srv/backups': { type: 'dir' } } };
    const appLog = '2026-11-22T09:02:18Z ERROR payment worker timeout\n2026-11-22T09:04:00Z INFO health check passed';
    const systemLog = '2026-11-22T08:59:58Z INFO training kernel started\n2026-11-22T09:02:45Z WARN memory usage above 80 percent';
    const archiveEntries = [{ path: 'var/log/training/app.log', content: appLog, mode: '0644' }, { path: 'var/log/training/system.log', content: systemLog, mode: '0644' }];
    const archivePath = '/home/learner/training-logs-2026-11-22.tar.gz';
    const files = { '/home/learner/connection.txt': { type: 'file', content: `Host: ${host}\nUser: learner\nFingerprint: ${remote.fingerprint}\nDestination: /srv/backups` }, '/var/log/training/app.log': { type: 'file', content: appLog }, '/var/log/training/system.log': { type: 'file', content: systemLog }, '/srv/recovery': { type: 'dir' }, '/srv/recovery/unrelated.txt': { type: 'file', content: 'preserve this file' } };
    const archives = {};
    if (lessonIndex > 0) { archives[archivePath] = archiveEntries; files[archivePath] = { type: 'file', content: JSON.stringify(archiveEntries) }; }
    return { host: 'backup-client', role: 'training operator', hostFingerprints: { [host]: remote.fingerprint }, hosts: { [host]: remote }, archives, files };
  }
  if (unit.code === 'A08') {
    const script = 'echo "Host: $HOSTNAME"\necho "Disk: $DISK"\necho "Memory: $MEMORY"\necho "Service: $SERVICE"\n';
    const files = lessonIndex === 0 ? {} : { '/home/learner/daily-report.sh': { type: 'file', content: script, mode: lessonIndex === 1 ? '0644' : '0755' } };
    return { host: 'schedule-lab', role: 'training operator', disk: { total: 30, used: 18, available: 12 }, memory: { total: 8192, used: 4096, free: 4096 }, services: { 'training-app': 'active (running)' }, trainingClock: '2026-11-22T08:00:00.000Z', files };
  }
  if (unit.code === 'A09') {
    const container = { id: '8f31a2', name: 'api-sim-web', image: 'linuxlab/api-sim:1.4', status: 'exited', restartCount: 3, logs: '2026-11-22T09:01:02Z INFO startup begin\n2026-11-22T09:02:18Z ERROR bind 0.0.0.0:443: address already in use' };
    const project = { name: 'api-sim', status: 'running', port: 30001, url: 'https://api.training.test:30001', startupLog: '2026-11-22T08:55:00Z INFO DDEV router bound to 30001\n2026-11-22T08:55:03Z INFO project api-sim started' };
    return {
      host: 'container-lab', role: lessonIndex === 2 ? 'training-admin' : 'read-only investigator', containers: [{ ...container }], portOccupants: { 443: 'legacy-gateway' },
      ddevProjects: { 'api-sim': { ...project } },
      endpoints: { 'https://api.training.test:443/health': { status: 404, body: '{"httpStatus":404,"error":"legacy-gateway route"}' }, 'https://api.training.test:30001/health': { status: 200, body: '{"httpStatus":200,"status":"healthy","project":"api-sim"}' } },
      files: { '/var/log/training/ddev-startup.log': { type: 'file', content: project.startupLog }, '/var/log/training/app.log': { type: 'file', content: '2026-11-22T08:55:04Z INFO api-sim application ready\n2026-11-22T09:02:18Z ERROR bind 0.0.0.0:443: address already in use' } },
    };
  }
  if (unit.code === 'A10') {
    const configured = lessonIndex > 0;
    return {
      role: 'training-admin',
      printerCatalog: [{ name: 'Training Floor Printer', uri: 'ipp://printer.training.test/ipp/print' }, { name: 'Unapproved Archive Printer', uri: 'ipp://archive.training.test/ipp/print' }],
      printerQueues: configured ? { lab_printer: { name: 'lab_printer', uri: 'ipp://printer.training.test/ipp/print', enabled: true, state: 'idle' } } : {},
      printJobs: lessonIndex === 2 ? [{ id: 204, queue: 'lab_printer', document: 'stuck-report.pdf', source: '/home/learner/stuck-report.pdf', status: 'stopped', reason: 'paper-out training fixture' }, { id: 205, queue: 'lab_printer', document: 'finance-summary.pdf', source: '/home/learner/finance-summary.pdf', status: 'queued', reason: null }] : [],
      nextPrintJobId: lessonIndex === 2 ? 206 : 1001,
      files: { '/home/learner/monthly-report.pdf': { type: 'file', content: 'Fictional monthly training report' }, '/home/learner/stuck-report.pdf': { type: 'file', content: 'Fictional report awaiting paper' }, '/home/learner/finance-summary.pdf': { type: 'file', content: 'Unrelated fictional finance summary' }, '/home/learner/replacement-report.pdf': { type: 'file', content: 'Approved replacement report' } },
    };
  }
  return unit.startingState || {};
}

function validateAppliedTask(unitCode, lessonIndex, taskIndex, env, command, stdout, result) {
  if (!result) return false;
  if (unitCode === 'B01') return validateMonitoringTask(lessonIndex, taskIndex, env, result);
  if (unitCode === 'B02') return validateIncidentTask(lessonIndex, taskIndex, env, result);
  if (unitCode === 'B03') return validateRequestLabTask(lessonIndex, taskIndex, env, result);
  if (unitCode === 'B04') return validateSecurityTask(lessonIndex, taskIndex, env, result);
  if (unitCode === 'B05') return validateDeploymentTask(lessonIndex, taskIndex, env, result);
  if (unitCode === 'A01' && lessonIndex === 0) {
    if (taskIndex === 0) return /^\s*(?:ls|find)\b/.test(command) && /config\.json/.test(stdout);
    if (taskIndex === 1) return ['/opt/training-api/config.json','/opt/training-api/README.txt'].every((path) => env.evidence?.includes(path));
    return /^\s*echo\b/.test(command) && stdout.includes('8080') && stdout.includes('8081') && /mismatch|differs|not equal/i.test(stdout)
      && ['/opt/training-api/config.json','/opt/training-api/README.txt'].every((path) => env.evidence?.includes(path));
  }
  if (unitCode === 'A01' && lessonIndex === 1) {
    const original = env.files['/opt/training-api/config.json.bak']?.content;
    const config = env.files['/opt/training-api/config.json']?.content;
    if (taskIndex === 0) return !!original && original.includes('8080') && config?.includes('8080');
    if (taskIndex === 1) { try { return JSON.parse(config || '{}').port === 8081 && original?.includes('8080'); } catch { return false; } }
    try { return /^\s*jq\b/.test(command) && !result.stderr && JSON.parse(config || '{}').port === 8081 && stdout.includes('8081'); } catch { return false; }
  }
  if (unitCode === 'A01' && lessonIndex === 2) {
    if (taskIndex === 0) return /^\s*systemctl\s+restart\s+training-api\s*$/.test(command) && env.services?.['training-api'] === 'active (running)';
    if (taskIndex === 1) return /^\s*curl\b/.test(command) && stdout.includes('"status":"healthy"');
    return /^\s*echo\b/.test(command) && /8081/.test(stdout) && /200/.test(stdout) && env.files['/var/log/training-api/app.log']?.content.includes('status=200') && env.evidence?.includes('/var/log/training-api/app.log');
  }
  if (unitCode === 'A02' && lessonIndex === 0) {
    if (taskIndex === 0) return env.evidence?.includes('identity:learner') && env.evidence?.includes('groups:report-reader');
    if (taskIndex === 1) return env.evidence?.includes('/srv/reports/monthly.csv');
    return result.exitCode === 0 && /^\s*echo\b/.test(command) && /0640/.test(stdout) && /finance-ops/.test(stdout) && /report-reader/.test(stdout);
  }
  if (unitCode === 'A02' && lessonIndex === 1) {
    const report = env.files['/srv/reports/monthly.csv'];
    if (taskIndex === 0) return /^\s*(?:chgrp|chown)\b/.test(command) && report?.group === 'report-users';
    if (taskIndex === 1) return /^\s*ls\s+-l\b/.test(command) && env.evidence?.includes('/srv/reports/monthly.csv') && report?.group === 'report-users' && report?.mode === '0640';
    return report?.mode === '0640' && !((Number.parseInt(report.mode, 8) & 0o004) > 0);
  }
  if (unitCode === 'A02' && lessonIndex === 2) {
    if (taskIndex === 0) return env.accessChecks?.['report-reader']?.allowed === true;
    if (taskIndex === 1) return env.accessChecks?.['guest-audit']?.allowed === false;
    return result.exitCode === 0 && /^\s*echo\b/.test(command) && /report-reader/.test(stdout) && /guest-audit/.test(stdout) && env.accessChecks?.['report-reader']?.allowed === true && env.accessChecks?.['guest-audit']?.allowed === false;
  }
  if (unitCode === 'A03' && lessonIndex === 0) {
    if (taskIndex === 0) return env.evidence?.includes('/home/learner/connection.txt');
    if (taskIndex === 1) return env.remoteSession?.key === 'lab-app-01.training.test';
    return env.host === 'lab-app-01' && env.evidence?.includes('host:lab-app-01') && env.evidence?.includes('identity:learner');
  }
  if (unitCode === 'A03' && lessonIndex === 1) {
    if (taskIndex === 0) return env.remoteSession?.key === 'lab-app-01.training.test' && env.evidence?.includes('host:lab-app-01') && env.evidence?.includes('identity:learner');
    if (taskIndex === 1) return env.evidence?.includes('/opt/training-api/config.json');
    return result.exitCode === 0 && /^\s*echo\b/.test(command) && /lab-app-01/.test(stdout) && /\/opt\/training-api\/config\.json/.test(stdout);
  }
  if (unitCode === 'A03' && lessonIndex === 2) {
    if (taskIndex === 0) return command === 'exit' && !env.remoteSession && env.host === 'learner-pc'
      && env.hosts?.['lab-app-01.training.test']?.files?.['/home/learner/remote-note.txt']?.content.includes('remote-only scratch note');
    if (taskIndex === 1) return /^\s*ls\b/.test(command) && !env.remoteSession && env.host === 'learner-pc' && !stdout.includes('remote-note.txt');
    return env.remoteSession?.key === 'lab-app-01.training.test' && env.evidence?.includes('/home/learner/remote-note.txt');
  }
  if (unitCode === 'A04' && lessonIndex === 0) {
    if (taskIndex === 0) return /^\s*getent\s+hosts\s+api\.training\.test\s*$/.test(command)
      && env.evidence?.includes('dns:api.training.test') && stdout.includes('10.24.1.30');
    if (taskIndex === 1) return env.evidence?.includes('network:interfaces') && env.evidence?.includes('network:routes')
      && env.evidence?.includes('/etc/training/client-destination.txt');
    return result.exitCode === 0 && /^\s*echo\b/.test(command) && stdout.includes('10.24.1.30') && stdout.includes('10.24.1.31');
  }
  if (unitCode === 'A04' && lessonIndex === 1) {
    if (taskIndex === 0) return /^\s*ss\s+-ltn\s*$/.test(command) && env.evidence?.includes('network:listeners')
      && stdout.includes(':443') && stdout.includes(':8443');
    if (taskIndex === 1) return env.evidence?.includes('/etc/training/port-map.txt')
      && /^\s*echo\b/.test(command) && stdout.includes('8443') && stdout.includes('443');
    const checks = env.network?.endpointChecks || [];
    return /^\s*echo\b/.test(command) && checks.some((check) => check.port === 443 && check.status === 404)
      && checks.some((check) => check.port === 8443 && check.status === 200) && stdout.includes('8443') && stdout.includes('404') && stdout.includes('200');
  }
  if (unitCode === 'A04' && lessonIndex === 2) {
    if (taskIndex === 0) return /^\s*openssl\s+s_client\s+-connect\s+api\.training\.test:443\s+-servername\s+api\.training\.test\s*$/.test(command)
      && env.evidence?.includes('tls:certificate') && env.evidence?.includes('tls:termination') && /subjectAltName=api\.training\.test/.test(stdout) && /verification=OK/.test(stdout);
    if (taskIndex === 1) return /^\s*waf\s+inspect\s*$/.test(command) && env.evidence?.includes('waf:event')
      && stdout.includes('10.24.8.12') && stdout.includes('198.51.100.24') && /not confirmed/.test(stdout);
    return /^\s*echo\b/.test(command) && /10\.24\.8\.12/.test(stdout) && /198\.51\.100\.24/.test(stdout)
      && /allowlist/.test(stdout) && /proxy/.test(stdout) && /not confirmed|needs confirmation|unconfirmed/.test(stdout)
      && /which.*ip|which address|source.*used/i.test(stdout);
  }
  if (unitCode === 'A05' && lessonIndex === 0) {
    if (taskIndex === 0) return /^\s*systemctl\s+status\s+training-site\s*$/.test(command)
      && env.evidence?.includes('service:training-site') && stdout.includes('failed');
    if (taskIndex === 1) return env.evidence?.includes('system:processes') && env.evidence?.includes('system:disk')
      && env.evidence?.includes('system:memory');
    return /^\s*echo\b/.test(command) && result.exitCode === 0 && stdout.includes('training-site')
      && stdout.includes('connection pool exhausted') && env.services?.['training-site']?.startsWith('failed');
  }
  if (unitCode === 'A05' && lessonIndex === 1) {
    if (taskIndex === 0) return env.evidence?.includes('/var/log/training/training-site.log');
    if (taskIndex === 1) return /^\s*grep\b/.test(command) && env.evidence?.includes('/var/log/training/training-site.log')
      && stdout.includes('2026-11-22T09:04:12Z') && stdout.includes('pool exhausted');
    return /^\s*echo\b/.test(command) && stdout.includes('09:04:12') && stdout.includes('pool exhausted');
  }
  if (unitCode === 'A05' && lessonIndex === 2) {
    const config = env.files['/opt/training-site/config.json']?.content;
    if (taskIndex === 0) { try { return /^\s*editor\s+set\b/.test(command) && JSON.parse(config || '{}').poolSize === 20; } catch { return false; } }
    if (taskIndex === 1) return /^\s*systemctl\s+restart\s+training-site\s*$/.test(command)
      && env.services?.['training-site'] === 'active (running)' && env.files['/var/log/training/training-site.log']?.content.includes('restart completed');
    return /^\s*echo\b/.test(command) && result.exitCode === 0 && stdout.includes('training-site') && stdout.includes('poolSize 20')
      && env.services?.['training-site'] === 'active (running)' && env.evidence?.includes('/var/log/training/training-site.log')
      && env.evidence?.includes('endpoint:https://status.training.test/health')
      && env.endpoints?.['https://status.training.test/health']?.status === 200;
  }
  if (unitCode === 'A06' && lessonIndex === 0) {
    if (taskIndex === 0) return env.evidence?.includes('/home/learner/db-connection.txt');
    if (taskIndex === 1) return /^psql\s/.test(command) && env.databaseSession?.database === 'incidents_lab';
    return command === '\\conninfo' && env.databaseSession?.user === 'trainee' && /incidents_lab/.test(stdout);
  }
  if (unitCode === 'A06' && lessonIndex === 1) {
    const table = env.practiceDatabases?.incidents_lab?.tables?.incidents;
    if (taskIndex === 0) return /^create\s+table\s+incidents\b/i.test(command) && !!table;
    if (taskIndex === 1) return /^insert\s+into\s+incidents\b/i.test(command) && table?.rows.length === 3;
    return /^\\d\s+incidents\s*$/.test(command) && table?.columns.some((column) => column.name === 'severity') && table?.rows.length === 3;
  }
  if (unitCode === 'A06' && lessonIndex === 2) {
    const table = env.practiceDatabases?.incidents_lab?.tables?.incidents;
    if (taskIndex === 0) return /^select\s+\*\s+from\s+incidents\s+where\s+severity\s*=\s*'high'/i.test(command) && result.rows?.length === 2;
    if (taskIndex === 1) return /^select\s+count\s*\(\s*\*\s*\)\s+from\s+incidents\s+where\s+severity\s*=\s*'high'/i.test(command) && stdout.endsWith('2') && table?.rows.length === 3;
    return /^echo\b/.test(command) && /reporting warehouse/i.test(stdout) && /not confirmed/i.test(stdout) && env.reportingEvidence?.transactionPathConfirmed === false;
  }
  if (unitCode === 'A07') {
    const archive = '/home/learner/training-logs-2026-11-22.tar.gz';
    if (lessonIndex === 0) {
      if (taskIndex === 0) return ['/var/log/training/app.log','/var/log/training/system.log'].every((path) => env.evidence?.includes(path));
      if (taskIndex === 1) return /^tar\s+-czf\s+training-logs-2026-11-22\.tar\.gz\s/.test(command) && env.archives?.[archive]?.length === 2;
      return /^tar\s+-tzf\s+training-logs-2026-11-22\.tar\.gz$/.test(command) && stdout.includes('var/log/training/app.log') && stdout.includes('var/log/training/system.log');
    }
    if (lessonIndex === 1) {
      const remotePath = '/srv/backups/training-logs-2026-11-22.tar.gz';
      if (taskIndex === 0) return env.evidence?.includes('/home/learner/connection.txt');
      if (taskIndex === 1) return /^scp\s+training-logs-2026-11-22\.tar\.gz\s+learner@backup-01\.training\.test:/.test(command) && !!env.hosts?.['backup-01.training.test']?.files?.[remotePath];
      const localHash = createHash('sha256').update(JSON.stringify(env.archives?.[archive] || [])).digest('hex');
      const remoteHash = createHash('sha256').update(JSON.stringify(env.hosts?.['backup-01.training.test']?.archives?.[remotePath] || [])).digest('hex');
      return /^sha256sum\s+training-logs-2026-11-22\.tar\.gz\s+\/tmp\/backup-copy\.tar\.gz$/.test(command)
        && env.files['/tmp/backup-copy.tar.gz']?.content === env.files[archive]?.content && localHash === remoteHash
        && stdout.split('\n').length === 2 && stdout.split('\n').every((line) => line.startsWith(`${localHash}  `));
    }
    const restored = ['/srv/recovery/var/log/training/app.log','/srv/recovery/var/log/training/system.log'];
    if (taskIndex === 0) return /^mkdir\s+-p\s+\/srv\/recovery\/var\/log\/training$/.test(command) && env.files['/srv/recovery/var/log/training']?.type === 'dir';
    if (taskIndex === 1) return /^tar\s+-xzf\s+training-logs-2026-11-22\.tar\.gz\s+-C\s+\/srv\/recovery$/.test(command) && restored.every((path) => env.files[path]?.type === 'file');
    return /^sha256sum\b/.test(command) && restored.every((path) => env.files[path]?.content === env.files[`/${path.slice('/srv/recovery/'.length)}`]?.content) && env.files['/srv/recovery/unrelated.txt']?.content === 'preserve this file' && restored.every((path) => stdout.includes(createHash('sha256').update(env.files[path].content).digest('hex')));
  }
  if (unitCode === 'A08' && lessonIndex === 0) {
    const script = env.files['/home/learner/daily-report.sh']?.content || '';
    if (taskIndex === 0) return /^printf\b/.test(command) && ['HOSTNAME','DISK','MEMORY','SERVICE'].every((key) => script.includes(`$${key}`));
    if (taskIndex === 1) return /^bash\s+daily-report\.sh\s*>\s*daily-report\.txt$/.test(command) && ['Host: schedule-lab','Disk: 18G used','Memory: 4096 MiB used','Service: active'].every((value) => env.files['/home/learner/daily-report.txt']?.content.includes(value));
    return /^cat\s+daily-report\.txt$/.test(command) && env.evidence?.includes('/home/learner/daily-report.txt') && stdout.includes('Host: schedule-lab');
  }
  if (unitCode === 'A08' && lessonIndex === 1) {
    if (taskIndex === 0) return /^ls\s+-l\s+daily-report\.sh$/.test(command) && env.files['/home/learner/daily-report.sh']?.mode === '0644';
    if (taskIndex === 1) return /^chmod\s+0755\s+daily-report\.sh$/.test(command) && env.files['/home/learner/daily-report.sh']?.mode === '0755';
    return /^\.\/daily-report\.sh$/.test(command) && result.stdout.includes('Host: schedule-lab') && env.files['/home/learner/daily-report.sh']?.mode === '0755';
  }
  if (unitCode === 'A08' && lessonIndex === 2) {
    if (taskIndex === 0) return /^crontab\s+add\b/.test(command) && env.schedule?.expression === '0 9 * * *' && env.schedule?.timezone === 'UTC';
    if (taskIndex === 1) return /^training-clock\s+advance\s+2h$/.test(command) && env.schedule?.runs.length === 1 && env.schedule.runs[0].time === '2026-11-22T09:00:00.000Z';
    return /^cat\s+daily-report\.txt$/.test(command) && env.schedule?.runs.length === 1 && stdout.includes('Host: schedule-lab') && env.files['/home/learner/daily-report.txt']?.content === stdout;
  }
  if (unitCode === 'A09' && lessonIndex === 0) {
    const container = env.containers?.find((item) => item.name === 'api-sim-web');
    if (taskIndex === 0) return /^docker\s+ps\s+-a$/.test(command) && env.evidence?.includes('container:list') && stdout.includes('api-sim-web');
    if (taskIndex === 1) return /^docker\s+inspect\s+api-sim-web$/.test(command) && env.evidence?.includes('container:api-sim-web') && stdout.includes('linuxlab/api-sim:1.4') && container?.restartCount === 3;
    return /^docker\s+logs\s+api-sim-web$/.test(command) && env.evidence?.includes('container-logs:api-sim-web') && stdout.includes('address already in use');
  }
  if (unitCode === 'A09' && lessonIndex === 1) {
    if (taskIndex === 0) return env.evidence?.includes('ddev:list') && env.evidence?.includes('ddev:describe') && stdout.includes('30001');
    if (taskIndex === 1) return env.evidence?.includes('ddev:logs') && env.evidence?.includes('/var/log/training/app.log') && env.files['/var/log/training/ddev-startup.log']?.content.includes('router bound');
    return /^echo\b/.test(command) && /api-sim/.test(stdout) && /running/.test(stdout) && /30001/.test(stdout) && env.ddevProjects?.['api-sim']?.url === 'https://api.training.test:30001';
  }
  if (unitCode === 'A09' && lessonIndex === 2) {
    const project = env.ddevProjects?.['api-sim'];
    if (taskIndex === 0) return env.portOccupants?.[443] === 'legacy-gateway' && /ddev\s+config\s+--router-https-port\s+30002/.test(command) && project?.port === 30002;
    if (taskIndex === 1) return /^ddev\s+restart\s+api-sim$/.test(command) && project?.status === 'running' && project.url === 'https://api.training.test:30002';
    return /^echo\b/.test(command) && stdout.includes('443') && stdout.includes('30002') && env.endpoints?.['https://api.training.test:443/health']?.status === 404 && env.endpoints?.['https://api.training.test:30002/health']?.status === 200 && env.evidence?.includes('endpoint:https://api.training.test:443/health') && env.evidence?.includes('endpoint:https://api.training.test:30002/health');
  }
  if (unitCode === 'A10' && lessonIndex === 0) {
    const queue = env.printerQueues?.lab_printer;
    if (taskIndex === 0) return command === 'lpinfo -v' && env.evidence?.includes('printer:catalog') && stdout.includes('ipp://printer.training.test/ipp/print');
    if (taskIndex === 1) return /^lpadmin\s+-p\s+lab_printer\b/.test(command) && queue?.uri === 'ipp://printer.training.test/ipp/print' && queue.enabled;
    return /^lpstat\s+-p$/.test(command) && stdout.includes('printer lab_printer is idle. enabled') && queue?.uri === 'ipp://printer.training.test/ipp/print';
  }
  if (unitCode === 'A10' && lessonIndex === 1) {
    const job = env.printJobs?.find((item) => item.document === 'monthly-report.pdf');
    if (taskIndex === 0) return env.evidence?.includes('/home/learner/monthly-report.pdf');
    if (taskIndex === 1) return /^lp\s+-d\s+lab_printer\s+.*monthly-report\.pdf$/.test(command) && job?.queue === 'lab_printer' && job.status === 'queued' && stdout.includes(`lab_printer-${job.id}`);
    return /^lpstat\s+-o$/.test(command) && job?.status === 'queued' && stdout.includes(`lab_printer-${job.id}`) && stdout.includes('monthly-report.pdf');
  }
  if (unitCode === 'A10' && lessonIndex === 2) {
    const stuck = env.printJobs?.find((job) => job.id === 204);
    const unrelated = env.printJobs?.find((job) => job.id === 205);
    const replacement = env.printJobs?.find((job) => job.document === 'replacement-report.pdf');
    if (taskIndex === 0) return /^lpstat\s+-o$/.test(command) && stdout.includes('stuck-report.pdf') && stdout.includes('finance-summary.pdf');
    if (taskIndex === 1) return command === 'cancel lab_printer-204' && stuck?.status === 'cancelled' && unrelated?.status === 'queued';
    return /^lpstat\s+-o$/.test(command) && stuck?.status === 'cancelled' && unrelated?.status === 'queued' && replacement?.status === 'queued' && stdout.includes('replacement-report.pdf');
  }
  return false;
}

export const appliedUnits = unitDefinitions.map((unit, index) => ({
  id: `${unit.track}-${unit.code}`,
  trackId: unit.track,
  number: unit.track === 'applied-linux' ? 6 + index : 16 + index - 10,
  title: unit.title,
  subtitle: unit.subtitle,
  color: ['mint','blue','purple','orange','pink'][index % 5],
}));

export const appliedLessons = unitDefinitions.flatMap((unit) => unit.scenarios.map((scenario, index) => ({
  id: `${unit.track}-${unit.code.toLowerCase()}-l${index + 1}`,
  sectionId,
  trackId: unit.track,
  unitId: `${unit.track}-${unit.code}`,
  unitNumber: unit.track === 'applied-linux' ? 5 + Number(unit.code.slice(1)) : 15 + Number(unit.code.slice(1)),
  lessonNumber: index + 1,
  unitTitle: unit.title,
  unitColor: ['mint','blue','purple','orange','pink'][(Number(unit.code.slice(1)) - 1) % 5],
  title: scenario[0],
  objective: scenario[1],
  intro: unit.intro,
  scenario: scenario[1],
  role: unit.code === 'A09' && index === 2 ? 'training administrator' : unit.role,
  workspaceType: unit.workspace,
  tools: unit.tools,
  prerequisites: [],
  duration: '8 min',
  time: '8 min',
  objectives: scenario[2].map((title, taskIndex) => {
    const hintTool = hintTools[unit.code]?.[index]?.[taskIndex] || unit.tools[taskIndex] || unit.tools[0];
    const hints = taskHints(title, hintTool, taskIndex, scenario[1]);
    return ({
    id: `${unit.code.toLowerCase()}-${index + 1}-task-${taskIndex + 1}`,
    title,
    description: title,
    expectedOutcome: scenario[3][taskIndex],
    hints,
    hint: hints[0],
    feedback: scenario[3][taskIndex],
    validate: (env, command, result) => validateAppliedTask(unit.code, index, taskIndex, env, command, result.stdout, result),
  }); }),
  expectedOutcomes: scenario[3],
  explanation: [unit.explanations[index]],
  recap: [unit.explanations[index]],
  startingState: scenarioState(unit, index),
  implementationStatus: ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','B01','B02','B03','B04','B05'].includes(unit.code) ? 'ready' : 'preview',
})));

export const appliedTracks = [
  { id: 'applied-linux', title: 'Applied Linux', units: appliedUnits.filter((unit) => unit.trackId === 'applied-linux') },
  { id: 'sre-operations', title: 'SRE Operations', units: appliedUnits.filter((unit) => unit.trackId === 'sre-operations') },
];

export const appliedSection = { id: sectionId, title: 'Applied Linux & SRE Practice', tracks: appliedTracks };
