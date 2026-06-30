SOLVELOG - AUDIO / TRACKLIST

The floating "TRACKLIST" player plays the tracks listed in `lib/tracks.ts`. The .mp3 files in
this folder are royalty-free instrumentals, named (kebab-case) after the reading-room theme and
committed to the repo so they deploy and play in production:

    everything-in-its-right-place.mp3
    the-gloaming.mp3                      <- the solve timer is named after it
    how-to-disappear-completely.mp3       <- quoted in the heatmap caption
    exit-music.mp3
    fake-plastic-trees.mp3
    let-down.mp3
    no-surprises.mp3

Player behaviour:
- DRAGGABLE: grab the grip handle (on the left) and drop the player anywhere. Its position is
  remembered and re-clamped into view on resize. Defaults to the bottom-RIGHT so it never covers
  the sidebar EXIT button (bottom-left).
- Playback is OFF by default and only starts on a user click (open the player, press play), so we
  never trip browser autoplay blocking.
- Any file that's missing is skipped gracefully -- the player shows "track not loaded" for that
  entry and stays silent.
- To change the list, names, or order, edit `lib/tracks.ts` (the player reads it). Keep files
  reasonably small (these are ~128 kbps) since they ship in the deploy.
- Supported: .mp3 (most compatible). For .m4a/.aac/.ogg, update the `src` in lib/tracks.ts.
