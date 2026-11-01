# Current audio timeline

Let D be the countdown deadline:

| Event | Time |
| --- | --- |
| Opening | Invoke + 0.08 seconds |
| Countdown | Opening + fixed 20 seconds |
| Ambience fade-in | Opening + 21.54 seconds, rising over 5 seconds |
| Tick fade | Opening + 21.54 through +26.80 seconds, gradually decreasing to zero |
| Low-time music | D − 123.75 seconds; short runs seek into the matching tail |
| Ambience → low-time overlap | First 6 seconds of low time |
| Ending begins at original source position 0 | D − 7 seconds |
| Low-time ends, ending source position 7 | D |
| Setup returns at ending source position 17 | D + 10 seconds |
| Audible ending finishes at source position 31.67 | D + 24.67 seconds |
| Original R.I.P. loop returns | At ending finish, fading in over 1.6 seconds |

All ending cues use the original uploaded recording's timestamps, including its quiet opening. Only trailing silent padding beyond source position 31.67 is omitted. Internal pauses remain intact.

# Gain and looping

All non-R.I.P. tracks have unity track gain outside their fades. R.I.P. has 0.22 track gain and repeats the untouched original samples. Master volume defaults to unity and remains user-adjustable.

Intro gain is unity until original position 21.54, then decreases linearly over 5.26 seconds to zero at 26.80. This lowers each successive tick instead of ending them abruptly. Recovery into the middle of this fade calculates the corresponding gain.

Ambience uses the approved A edit: native loopStart at sample 579726 and loopEnd at sample 3514051, expressed at the original 44.1 kHz rate. The original opening plays once, then a matching 66.537982-second musical cycle repeats. Samples are unchanged, with no per-loop gain modulation or blending. Recovery wraps offsets inside that same musical region after the first pass. Ambience and low-time music still overlap for six seconds with power fades. The ending starts early underneath the low-time tail, preserving original position 7 at zero.

# Controls and recovery

Web Audio mixes the original recordings into a native HTML audio element through a MediaStream destination. Media Session and native events pause/resume the active timer. Active seeking shifts the shared wall clock; extending a timer rebuilds its remaining cues.

Timer actions are available only before D (zero). At D the app clears progress, unregisters timer actions, and rejects stale calls. Pause/reset buttons on the active timer also lock during the ending. Native pause events cannot stop that ending.

At the R.I.P. handoff, only play/pause actions become available. They suspend/resume the music transport while leaving the finished timer unpaused. For a retained completed run, its post-ending audio position is held and restored so R.I.P. resumes from the paused point. Recovery and the watchdog respect an intentional R.I.P. pause. Initial setup has the same music-only behavior. Seek and skip remain unavailable.

The watchdog detects context interruptions, frozen clocks, output stalls, and prolonged zero output. Recovery seeks to the correct position instead of restarting earlier music. Hidden-tab rendering does not determine audio cue scheduling.

Playback is 44.1 kHz stereo with a music content hint and requests to disable voice processing. No original audio is re-encoded. Artwork is opaque square PNG at 192px and 512px. Browser checks cover these properties and text containment; physical-device audio quality and OS presentation remain device-dependent.

# Screen and alignment

An original 5×7-grid pixel alphabet is embedded as WOFF. The timer uses its constant six-cell glyph advance with no negative letter spacing, and is centered by intrinsic text width. Browser checks measure text-range centers for 00:00, 11:11, and 999:59 across portrait widths. The minute and second editor uses equal grid columns around the colon.

The outer casing and dark inset glass are built with CSS borders and shadows. Backgrounds use linear fills rather than the earlier page-level radial gradients. The screen has a low-opacity pixel/scanline overlay, a slow scan sweep, a cursor blink, and a brief startup animation. Reduced-motion mode disables moving effects.

# Performance build and media titles

Audio packets are stream-copied into clean Ogg containers, with conservative truncation after the last played sample. Every needed sample was verified identical in FFmpeg and Chromium. R.I.P. is copied unchanged. The ambience file now ends after the approved native loopEnd plus a decoder safety margin; its loopStart and loopEnd remain exactly the same.

The hosted HTML contains only audio URLs. A deferred, separately cached runtime script starts decoding audio after the Enter gesture. Versioned URLs prevent mismatched cached scripts/audio on updates. The standalone HTML contains the same optimized files as base64 for offline use.

Static media-title mode shows the configured duration followed by “timer”. It does not publish metadata or media position on each tick; play state, duration changes, seek, and pause/resume remain synchronized. Live mode publishes the title when its displayed second changes and refreshes the native progress snapshot at most every ten seconds outside state changes. Native media progress advances without frequent JavaScript snapshots. Repeated DOM text and document-title assignments are skipped when unchanged.
