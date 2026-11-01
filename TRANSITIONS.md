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

Ambience repeats the original decoded recording at its full approximately 88.615-second duration, using AudioBufferSourceNode.loop exactly like R.I.P. No samples are rearranged and no gain changes occur at loop boundaries. The former six-second tail/head remix has been removed because it produced an audible volume swell/dip on each repeat. Its one-time entrance fade remains; ambience and low-time music still overlap for six seconds with power fades. The ending starts early underneath the low-time tail, preserving original position 7 at zero.

# Controls and recovery

Web Audio mixes the original recordings into a native HTML audio element through a MediaStream destination. Media Session and native events pause/resume the active timer. Active seeking shifts the shared wall clock; extending a timer rebuilds its remaining cues.

Timer actions are available only before D (zero). At D the app clears progress, unregisters timer actions, and rejects stale calls. Pause/reset buttons on the active timer also lock during the ending. Native pause events cannot stop that ending.

At the R.I.P. handoff, only play/pause actions become available. They suspend/resume the music transport while leaving the finished timer unpaused. For a retained completed run, its post-ending audio position is held and restored so R.I.P. resumes from the paused point. Recovery and the watchdog respect an intentional R.I.P. pause. Initial setup has the same music-only behavior. Seek and skip remain unavailable.

The watchdog detects context interruptions, frozen clocks, output stalls, and prolonged zero output. Recovery seeks to the correct position instead of restarting earlier music. Hidden-tab rendering does not determine audio cue scheduling.

Playback is 44.1 kHz stereo with a music content hint and requests to disable voice processing. No original audio is re-encoded. Artwork is opaque square PNG at 192px and 512px. Browser checks cover these properties and text containment; physical-device audio quality and OS presentation remain device-dependent.

# Screen and alignment

An original 5×7-grid pixel alphabet is embedded as WOFF. The timer uses its constant six-cell glyph advance with no negative letter spacing, and is centered by intrinsic text width. Browser checks measure text-range centers for 00:00, 11:11, and 999:59 across portrait widths. The minute and second editor uses equal grid columns around the colon.

The outer casing and dark inset glass are built with CSS borders and shadows. Backgrounds use linear fills rather than the earlier page-level radial gradients. The screen has a low-opacity pixel/scanline overlay, a slow scan sweep, a cursor blink, and a brief startup animation. Reduced-motion mode disables moving effects.
