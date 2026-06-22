// The journal's "TRACKLIST" - the soundtrack for the reading room.
// Drop the matching .mp3 files into `public/audio/` using EXACTLY these filenames. The player
// (components/paper/music-player.tsx) reads this manifest; any file that's missing is skipped
// gracefully (the player stays silent, no errors). Playback is OFF by default and only starts
// on a user click, so we never trip browser autoplay blocking.
// You own/licensed these tracks. Curated for the theme: instrumental / calm, so the music sits
// UNDER the data instead of fighting it. Reorder or trim freely.

export interface Track {
  /** path under /public - must match the real filename you drop in public/audio/ */
  src: string;
  title: string;
  album: string;
}

export const TRACKS: Track[] = [
  { src: "/audio/everything-in-its-right-place.mp3", title: "Everything In Its Right Place", album: "Kid A" },
  { src: "/audio/the-gloaming.mp3", title: "The Gloaming", album: "Hail to the Thief" },
  { src: "/audio/how-to-disappear-completely.mp3", title: "How to Disappear Completely", album: "Kid A" },
  { src: "/audio/exit-music.mp3", title: "Exit Music (For a Film)", album: "OK Computer" },
  { src: "/audio/fake-plastic-trees.mp3", title: "Fake Plastic Trees", album: "The Bends" },
  { src: "/audio/let-down.mp3", title: "Let Down", album: "OK Computer" },
  { src: "/audio/no-surprises.mp3", title: "No Surprises", album: "OK Computer" },
];
