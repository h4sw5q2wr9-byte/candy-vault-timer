# R.I.P. · The Candy Vault Timer

[Open the timer](https://h4sw5q2wr9-byte.github.io/candy-vault-timer/)

Use the live website and select **Enter the Terminal**. The web build loads a small page and script, then fetches separately cached audio when you enter. For a single file that works offline, [download `standalone.html`](standalone.html); it embeds the audio, font, and artwork.

Choose a gravestone preset or enter minutes and seconds, then select **Invoke**. The countdown starts at 20 seconds into the intro. The R.I.P.-inspired interface has an angular bronze cabinet, dark amber glass, gravestone cards, and a “Choose wisely” prompt. The terminal fills portrait screens; landscape puts the timer and controls side by side. An embedded pixel font and subtle CRT effects respect reduced-motion settings. Text containment is checked at 320–1440 px and landscape controls down to 667×375. The duration editor and running digits stay centered.

## Soundtrack

- Original R.I.P. audio repeats quietly at 22% track gain, without sample edits.
- All other tracks use full track gain. The master volume defaults to 100%; users can lower it with the volume slider. Transition fades still apply.
- The countdown begins at intro position **20 seconds**.
- Ambience enters under the ticks at **21.54 seconds**, rising over five seconds. At the same point, the intro begins a **5.26-second gradual fade**, making successive ticks softer through its end at 26.80 seconds.
- Ambience preserves its original opening, then repeats a matched musical section from original 13.145714 to 79.683696 seconds (a 66.537982-second cycle). There is no per-loop fade or sample remix. During the final pass it continues into the original tail, so the outgoing melody does not wrap halfway through the transition.
- The approved **D — Together** mix uses an eight-second overlap. Low time's bass starts with a gentle −4 dB shelf at 100 Hz, and its ticking range with a −8 dB shelf at 900 Hz. Both ease back to flat over eight seconds, so melody and ticking grow together. The rest of low time plays with its original sound. The fade uses the selected later handover shape; the intro and ambience retain their normal starting positions.
- The EQ entrance is prepared once into a short 8.2-second buffer (including filter settling), so pause/resume and seeking restore the same sound without live filters or runtime musical analysis. The remaining low-time samples use the original buffer. Short timers without an ambience handoff retain their existing low-time-tail behavior.
- The ending begins seven seconds before zero, using original MP3 timestamps. At zero, low time ends and the ending reaches original position **7 seconds**.
- The ending stays at full gain through original source position **15 seconds**, fades linearly to silence at **17 seconds**, and stops there. Setup and the original quiet R.I.P. loop return at 17 seconds; R.I.P. fades in over 1.6 seconds. Later ending audio is omitted.
- Escape_music remains removed. Internal pauses in the ending remain intact.

## Phone media controls

Media behavior follows three modes:

- **Before zero:** **Keep timer running when music pauses** is enabled by default and saved on the device. Other-media interruptions and OS pause silence the soundtrack while the wall-clock countdown continues. Play or **Resume music** seeks to the current soundtrack position. The explicit **Pause timer** button freezes both. Turn the setting off to restore OS pause/resume of timer and music together. Previous/next add/remove one minute; seeking changes elapsed time where supported.
- **At zero and during the ending:** timer edit, seek, skip, and pause actions are unregistered. The ending continues. Stale timer actions cannot move the finished countdown.
- **When R.I.P. returns:** play/pause controls only R.I.P. music. Seeking, skipping, and timer editing stay unavailable. Pausing does not set the finished timer to paused or restart it. The small Pause/Play button beside the music label offers the same music-only control.

In Settings, **Live media countdown** controls the title. When enabled, it shows the short remaining time; when disabled it stays at the chosen duration, such as **20:00 timer**. Paused music is explicitly titled **Music paused · 20:00**, and pending playback is marked **Resuming** until native playback is confirmed. The preference is saved on the device. Static mode avoids repeated metadata and position writes; state changes and seeking still publish snapshots. Progress is cleared at zero. The OS chooses collapsed Dynamic Island graphics and button availability; expanded/lock-screen metadata reports the music state.

Native Play invokes media-element playback and audio-context resume synchronously within the original control callback. It does not wait for a pending suspension or an earlier play request. Native playing/state-change events can confirm success even if WebKit leaves a resume promise pending. New pause requests cancel old activations, and queued element events are ignored when they contradict the element's current paused state. AudioSession interruptions are also observed where supported.

Elapsed time stays accurate in hidden tabs. With keep-counting enabled, the watchdog respects music pauses and does not compete with another app for audio. At zero the page makes one attempt to resume the ending at its current cue. If iOS suspends the page past the whole ending, it plays a short completion cue when the page wakes; blocked playback leaves **Resume music** available. A web page cannot guarantee a wake-up alarm while the OS suspends it. Automatic recovery still repairs unintentional stalls. Optional **Keep screen awake** is under Settings. Closing/reloading the page ends the current in-memory session.

The audio cleanup uses stream copy, not lossy re-encoding: downloader metadata and never-played tails are removed. The complete original ambience tail is retained for its final handoff. R.I.P. stays byte-for-byte original to protect its gapless timing. The ending asset retains its original samples through 17 seconds plus a small decoder margin. Decoded source samples were checked against the originals with zero difference; transition fades and the selected low-time EQ are separate playback effects. Audio transfers are about 10% smaller. Playback uses source-matched 44.1 kHz stereo and a music content hint.

## Verification and source

- `node verify.cjs`: gradual tick fade, unity gain except R.I.P., fixed start, lock-at-zero, music-only R.I.P. pause, cue alignment, matched loop points, recovery after multiple wraps, seeking, pause/resume, recovery, and duration validation.
- Keep-counting checks cover saved/default preferences, native pause versus timer pause, external context interruptions, resumed soundtrack positions, a blocked finish-sound attempt, manual recovery, and a late completion cue.
- Native-play regressions cover an unresolved suspension, a resume that waits for play, a permanently pending resume with observable native playback, stale pause/play events, AudioSession-only interruption, and commands replacing pending commands. Ending checks verify the 15–17-second fade and recovery halfway through it.
- `python browser-check.py`: Chromium playback, PCM signal, opaque artwork, short media title, grave-text containment across six widths, phone button visibility, centered duration and timer text, embedded pixel font, reduced-motion fallback, lock-at-zero, and music-only R.I.P. play/pause.
- `python handoff-check.py`: renders the production scheduler and compares it with the approved D audio, including recovery during and after the EQ entrance. This listening-reference check requires the local audition file at `/workspace/candy-vault-tick-tests/D-together.f32`.
- Edit `app.js`, `style.css`, or `shell.html`, then run `python build.py`. It verifies the audio-manifest hashes and emits `index.html` plus the small `app-runtime.js` for hosting, and the self-contained `standalone.html` for offline use. Keep `assets/audio/`, icons, the manifest, and generated files in the same project.

This is an unofficial DOORS fan project using user-supplied audio and visual references.

## GitHub Pages

The site is a static page served from the root of the `main` branch, with `.nojekyll` to skip Jekyll processing. The web runtime uses `index.html`, `app-runtime.js`, and same-origin `assets/audio/` files with versioned URLs for independent browser caching. Initial HTML is about 35 KB and the runtime script about 25 KB, compared with the previous 6.7 MB HTML. The offline version remains self-contained. There is no application server, analytics, or account system.

For updates, change the source files, rebuild with `python build.py`, run `node verify.cjs`, and commit the generated web files, offline HTML, and any changed assets along with the source. Pushing `main` triggers the Pages deployment.

## Name, home-screen image, and search

The page, app manifest, Apple web-app title, and social metadata use **The Candy Vault Timer**. The 180px Apple touch icon and 192/512px manifest icons use the opaque square R.I.P. artwork. The Apple icon has a content-versioned filename, and manifest/favicon URLs have content versions to avoid reusing stale cached images.

If an iPhone Home Screen icon still shows a fallback letter, remove that old shortcut, open the live GitHub Pages URL directly in Safari, and use Share → Add to Home Screen. Adding an HTML-viewer page or a shortcut from an embedded browser may use that host's metadata. Updating the website cannot force an already-saved Home Screen icon to refresh. No service worker is installed; use the single-file download for guaranteed offline use.

The site has a canonical URL, index/follow metadata, Open Graph image, structured WebApplication metadata, `sitemap.xml`, and `robots.txt`. It is publicly accessible, but Google indexing is not confirmed. Search requests in this environment returned a redirect/challenge rather than verifiable results. To request indexing, the owner can verify the site URL prefix in Google Search Console and submit its sitemap or inspect the URL. Google's crawler reads robots.txt at the domain root; the project-level file is provided for transparency and does not change the host root's policy.

See `CREDITS.md` and `audio-optimization-report.json` for attribution and the lossless audio audit.
