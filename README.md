# R.I.P. · The Candy Vault Timer

[Open the timer](https://h4sw5q2wr9-byte.github.io/candy-vault-timer/)

Open `index.html` in a current browser and select **Enter the Terminal**. Five original audio files and square R.I.P. artwork are embedded. No audio folder or server is required; HTTPS hosting is recommended for phone browser features.

Choose a gravestone preset or enter minutes and seconds, then select **Invoke**. Session naming and the intro-timing setting have been removed. The start remains fixed at 20 seconds into the intro. The interface is presented inside a physical CRT housing with a beveled bezel, inset amber glass, speaker vents, and a power indicator. An original embedded pixel font keeps text consistent across devices. Subtle scanlines, a slow sweep, cursor blink, and a screen-on animation respect reduced-motion settings. Gravestones and fitted text are checked at 320, 375, 390, 430, 768, and 1440 px. The portrait duration editor and running digits are centered, including long time values.

## Soundtrack

- Original R.I.P. audio repeats quietly at 22% track gain, without sample edits.
- All other tracks use full track gain. The master volume defaults to 100%; users can lower it with the volume slider. Transition fades still apply.
- The countdown begins at intro position **20 seconds**.
- Ambience enters under the ticks at **21.54 seconds**, rising over five seconds. At the same point, the intro begins a **5.26-second gradual fade**, making successive ticks softer through its end at 26.80 seconds.
- Ambience uses a six-second correlation-compensated loop blend and a six-second crossfade into low-time music.
- The ending begins seven seconds before zero, using original MP3 timestamps. At zero, low time ends and the ending reaches original position **7 seconds**.
- Setup returns at original ending position **17 seconds**. When the audible ending finishes at 31.67 seconds, the original R.I.P. loop fades in over 1.6 seconds.
- Escape_music remains removed. Internal pauses in the ending remain intact.

## Phone media controls

Media behavior follows three modes:

- **Before zero:** supported OS controls pause/resume the timer and music together. Previous/next add/remove one minute; seeking changes elapsed time where supported.
- **At zero and during the ending:** timer edit, seek, skip, and pause actions are unregistered. The ending continues. Stale timer actions cannot move the finished countdown.
- **When R.I.P. returns:** play/pause controls only R.I.P. music. Seeking, skipping, and timer editing stay unavailable. Pausing does not set the finished timer to paused or restart it. The small Pause/Play button beside the music label offers the same music-only control.

The media title remains the short countdown, with the app name on the secondary line. Progress is cleared at zero. The OS controls visual button availability; native pause events during the ending are neutralized, while native play/pause events during R.I.P. are honored.

Elapsed time stays accurate in hidden tabs. Automatic recovery handles suspended or stalled clocks and audio output interruptions. Optional **Keep screen awake** is under Settings. Phone sleep, calls, browser closure, and OS policies can still interrupt sound.

Original audio remains unchanged. Playback uses source-matched 44.1 kHz stereo, a music content hint, and optional constraints disabling voice processing. Browser checks verify those settings; subjective sound quality on a phone still needs listening verification.

## Verification and source

- `node verify.cjs`: gradual tick fade, unity gain except R.I.P., fixed start, lock-at-zero, music-only R.I.P. pause, cue alignment, loop blending, seeking, pause/resume, recovery, and duration validation.
- `python browser-check.py`: Chromium playback, PCM signal, opaque artwork, short media title, grave-text containment across six widths, phone button visibility, centered duration and timer text, embedded pixel font, reduced-motion fallback, lock-at-zero, and music-only R.I.P. play/pause.
- Edit `app.js`, `style.css`, or `shell.html`, then run `python build.py` to rebuild the standalone HTML while preserving embedded original audio.

This is an unofficial DOORS fan project using user-supplied audio and visual references.

## GitHub Pages

The site is a static page served from the root of the `main` branch, with `.nojekyll` to skip Jekyll processing. The runtime is the self-contained `index.html`; artwork, font, and soundtracks are embedded. No server, dependencies, analytics, or account system is required to use it.

For updates, change the source files, rebuild with `python build.py`, run `node verify.cjs`, and commit the generated `index.html` along with the source. Pushing `main` triggers the Pages deployment.
