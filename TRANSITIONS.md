# Current audio timeline

Let D be the countdown deadline:

| Event | Time |
| --- | --- |
| Opening | Invoke + 0.08 seconds |
| Countdown | Opening + fixed 20 seconds |
| Ambience fade-in | Opening + 21.54 seconds, rising over 5 seconds |
| Tick fade | Opening + 21.54 through +26.80 seconds, gradually decreasing to zero |
| Low-time music | D − 123.75 seconds; short runs seek into the matching tail |
| Ambience → low-time overlap | Approved D mix, first 8 seconds of low time |
| Bass and ticking EQ returns to flat | Low-time source position 8 seconds |
| Prepared EQ entrance rejoins original low time | Source position 8.2 seconds |
| Ending begins at original source position 0 | D − 7 seconds |
| Low-time ends, ending source position 7 | D |
| Setup returns at ending source position 17 | D + 10 seconds |
| Ending fades from original source position 15 to 17 | D + 8 through D + 10 seconds |
| Audible ending finishes at source position 17 | D + 10 seconds |
| Original R.I.P. loop returns | At ending finish, fading in over 1.6 seconds |

All ending cues use the original uploaded recording's timestamps, including its quiet opening. The ending fades linearly from full gain at original position 15 to zero at 17; all later audio is omitted. Internal pauses before that point remain intact. Zero still coincides with original position 7, and setup/R.I.P. return at position 17.

# Gain and looping

All non-R.I.P. tracks have unity track gain outside their fades. R.I.P. has 0.22 track gain and repeats the untouched original samples. Master volume defaults to unity and remains user-adjustable.

Intro gain is unity until original position 21.54, then decreases linearly over 5.26 seconds to zero at 26.80. This lowers each successive tick instead of ending them abruptly. Recovery into the middle of this fade calculates the corresponding gain.

Ambience uses native loopStart at sample 579726 and loopEnd at sample 3514051, expressed at the original 44.1 kHz rate. The original opening plays once, then a matching 66.537982-second musical cycle repeats. Samples are unchanged, with no per-loop gain modulation or blending. Recovery wraps offsets inside that same musical region after the first pass. At low time's scheduled start, a sample-aligned final source continues from the current position into the original tail, with looping disabled. All possible loop phases have enough original tail for the eight-second handoff. No starting offset is imposed on the intro or ambience.

The selected D mix uses an eight-second equal-power overlap, with a monotonic cubic handover curve reaching equal track gain at 5.085170 seconds. Its gain curve is sampled into scheduled audio-time ramps. This is the selected listening preset, not automatic selection of new musical cue points. Low time's start and timer zero stay fixed.

Low time receives a low shelf at 100 Hz starting at −4 dB and a high shelf at 900 Hz starting at −8 dB. Both return to 0 dB over eight seconds using a raised-cosine gain curve. This lets the bass melody and ticking rise together. Only an 8.2-second EQ entrance is rendered once with OfflineAudioContext, including 0.2 seconds for filter-state settling. The original source then resumes at 8.2 seconds, without a timing change or extra file download. No filters or musical analysis run during playback. Recovery seeks into the prepared entrance, so it does not reset filter history. Short timers without ambience use their original shortened low-time tail.

The ending starts early underneath the low-time tail, preserving original position 7 at zero.

# Controls and recovery

Web Audio mixes the original recordings into a native HTML audio element through a MediaStream destination. By default, native pause silences only music and the deadline keeps advancing. The in-page Pause timer button freezes both. The saved Keep timer running when music pauses preference can restore native pause of timer and music together. Active seeking shifts the shared wall clock; extending a timer rebuilds its remaining cues.

Timer actions are available only before D (zero). At D the app clears progress, unregisters timer actions, and rejects stale calls. Pause/reset buttons on the active timer also lock during the ending. Native pause events cannot stop that ending.

At the R.I.P. handoff, only play/pause actions become available. They suspend/resume the music transport while leaving the finished timer unpaused. For a retained completed run, its post-ending audio position is held and restored so R.I.P. resumes from the paused point. Recovery and the watchdog respect an intentional R.I.P. pause. Initial setup has the same music-only behavior. Seek and skip remain unavailable.

The watchdog detects context interruptions, frozen clocks, output stalls, and prolonged zero output. Recovery seeks to the correct position instead of restarting earlier music. Hidden-tab rendering does not determine audio cue scheduling.

Playback is 44.1 kHz stereo with a music content hint and requests to disable voice processing. No original audio is re-encoded. Artwork is opaque square PNG at 192px and 512px. Browser checks cover these properties and text containment; physical-device audio quality and OS presentation remain device-dependent.

# Screen and alignment

An original 5×7-grid pixel alphabet is embedded as WOFF. The timer uses its constant six-cell glyph advance with no negative letter spacing, and is centered by intrinsic text width. Browser checks measure text-range centers for 00:00, 11:11, and 999:59 across portrait widths. The minute and second editor uses equal grid columns around the colon.

The angular bronze casing and inset glass use CSS polygons, borders and shadows. The terminal fills portrait screens, and a compact landscape grid keeps controls beside the timer. The settings drawer scrolls within short viewports. Low-opacity scanlines, a slow sweep, cursor blink and startup animation respect reduced-motion preferences.

Keep-counting mode stops scheduled audio and suspends the audio context while the wall clock continues. The watchdog respects this state. Resume music rebuilds the score at the current virtual time. Pause timer excludes its deliberate pause from the wall clock and preserves whether music was already silent. A timeout plus render/watchdog checks attempt the ending at zero; iOS suspension may delay that attempt. A late wake after the complete ending schedules a short cue from source position 7, then R.I.P., without altering timer zero. Playback rejection leaves a manual Resume music action and is not retried continuously. This remains an in-memory web timer, not a guaranteed OS alarm.

Pause publishes its state and metadata immediately, without awaiting context suspension. Explicit native Play calls resume() and play() synchronously in the same callback, even if the browser's state flags appear healthy. Playback is confirmed by a playing event or fulfilled play promise together with an actually running context; an unresolved resume promise does not block observed success. A newer command cancels the previous activation instead of waiting in a promise queue. A stale element pause event cannot undo a newer Play (and vice versa). Temporary resume status stays paused until playback is confirmed. AudioSession state changes supplement element/context interruption events where supported. iOS may still impose platform restrictions; WebKit tracks background resume issues at https://bugs.webkit.org/show_bug.cgi?id=281566.

# Performance build and media titles

Audio packets are stream-copied into clean Ogg containers, with conservative truncation after the last played sample. Every needed sample was verified identical in FFmpeg and Chromium. R.I.P. is copied unchanged. The ambience keeps its entire original tail for the unlooped final handoff; its loopStart and loopEnd remain exactly the same.

The hosted HTML contains only audio URLs. A deferred, separately cached runtime script starts decoding audio after the Enter gesture. Versioned URLs prevent mismatched cached scripts/audio on updates. The standalone HTML contains the same optimized files as base64 for offline use. The full original ambience tail is retained for the final handoff; its source PCM remains unchanged.

Static media-title mode shows the configured duration followed by “timer”. It does not publish metadata or media position on each tick; play state, duration changes, seek, and pause/resume remain synchronized. Live mode publishes the title when its displayed second changes and refreshes the native progress snapshot at most every ten seconds outside state changes. Native media progress advances without frequent JavaScript snapshots. Repeated DOM text and document-title assignments are skipped when unchanged.
