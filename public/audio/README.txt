SOLVELOG - AUDIO / TRACKLIST

The floating "TRACKLIST" player plays the tracks listed in `lib/tracks.ts`. Drop your
licensed/owned .mp3 files into THIS folder using EXACTLY these (kebab-case) filenames:

    everything-in-its-right-place.mp3     (Kid A)
    the-gloaming.mp3                      (Hail to the Thief)  <- the timer is named after it
    how-to-disappear-completely.mp3       (Kid A)              <- quoted in the heatmap caption
    exit-music.mp3                        (OK Computer)
    fake-plastic-trees.mp3                (The Bends)
    let-down.mp3                          (OK Computer)
    no-surprises.mp3                      (OK Computer)

Player behaviour:
- DRAGGABLE: grab the grip handle (the grip handle on the left) and drop the player anywhere. Its position
  is remembered and re-clamped into view on resize. Defaults to the bottom-RIGHT so it never
  covers the sidebar EXIT button (bottom-left).
- Playback is OFF by default and only starts on a user click (open the player, press play),
  so we never trip browser autoplay blocking.
- Any file that's missing is skipped gracefully -- the player shows "track not loaded" for
  that entry and stays silent. You can add files one at a time.
- To change the list, names, or order, edit `lib/tracks.ts` (the player reads it).
- Supported: .mp3 (most compatible). For .m4a/.aac/.ogg, update the `src` in lib/tracks.ts.
