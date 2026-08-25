import type { BriefSegment } from "@/lib/brief";

export const SEED_SHOWS = [
  {
    id: "seed_show_upfirst",
    itunesId: "1222114325",
    title: "Up First from NPR",
    artist: "NPR",
    feedUrl: "https://feeds.npr.org/510318/podcast.xml",
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/0e/35/25/0e352569-e694-81d9-ea55-5f935981c15a/mza_1788275989855583986.png/600x600bb.jpg",
    description:
      "NPR's Up First is the news you need to start your day. The three biggest stories of the day, with reporting and analysis from NPR News.",
  },
  {
    id: "seed_show_planetmoney",
    itunesId: "290783428",
    title: "Planet Money",
    artist: "NPR",
    feedUrl: "https://feeds.npr.org/510289/podcast.xml",
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/85/df/53/85df5334-0fae-28a9-2bc4-b97b81061d0e/mza_10839245066228881011.jpg/600x600bb.jpg",
    description:
      "Wanna see a trick? Give us any topic and we can tie it back to the economy. At Planet Money, we explore the forces that shape our lives.",
  },
] as const;

export type SeedBrief = {
  overview: string;
  segments: BriefSegment[];
  takeaways: string[];
  spokenRecap: string;
  sourceType: "shownotes";
  confidenceNote: string;
  guest: string | null;
};

export const SEED_EPISODES = [
  {
    id: "seed_ep_upfirst_palmyra",
    showId: "seed_show_upfirst",
    guid: "2aeab1d5-aa11-4db6-bac2-c9c026de40b1",
    title: "A visit to the remote Pacific island ecosystem losing protections",
    publishedAt: new Date("2026-08-23T07:00:00.000Z"),
    link: "https://www.npr.org/2026/08/23/nx-s1-5940802/http-npr-org-2026-08-23-nx-s1-5940802-a-visit-to-the-remote-pacific-island-ecosystem-losing-protections",
    audioUrl: null,
    description:
      "A thousand miles south of Hawaii, in the middle of the Pacific Ocean, a series of tiny islands form an atoll, called Palmyra. Palmyra Atoll is part of four protected U.S. marine monuments, forming the country’s largest environmental conservation area. It is also home to a thriving ecosystem of birds, marine life, and one of the most pristine coral reefs in the world. No people live on Palmyra full time, and it is rare for journalists to be granted access. But the Trump administration is now trying to roll back longstanding protections by opening nearby waters to commercial fishing. NPR’s Lauren Sommer was given access to visit Palmyra Atoll. Newly back from her trip, she tells host Ayesha Rascoe about everything she saw. They talk about the wildlife, the ocean, the reefs, and what the islands and offshore waters mean to native Hawaiians, conservationists, and commercial fishers.",
    guest: "Lauren Sommer",
    brief: {
      overview:
        "NPR’s Lauren Sommer reports from Palmyra Atoll, a remote Pacific conservation area about a thousand miles south of Hawaii, and talks with host Ayesha Rascoe about what she saw there. Official show notes say the Trump administration is trying to roll back longstanding protections by opening nearby waters to commercial fishing.",
      segments: [
        {
          title: "Where Palmyra sits",
          speaker: "unknown" as const,
          summary:
            "Show notes locate Palmyra Atoll a thousand miles south of Hawaii in the Pacific, as a series of tiny islands that form an atoll.",
        },
        {
          title: "Why the atoll is protected",
          speaker: "unknown" as const,
          summary:
            "Palmyra is part of four protected U.S. marine monuments that the notes describe as the country’s largest environmental conservation area, with birds, marine life, and one of the most pristine coral reefs in the world.",
        },
        {
          title: "Access and reporting",
          speaker: "guest" as const,
          summary:
            "No people live on Palmyra full time, journalist access is rare, and NPR’s Lauren Sommer was given access to visit. Newly back, she tells host Ayesha Rascoe what she saw.",
        },
        {
          title: "The policy fight over nearby waters",
          speaker: "both" as const,
          summary:
            "The notes say the Trump administration is trying to roll back longstanding protections by opening nearby waters to commercial fishing. Sommer and Rascoe discuss wildlife, the ocean, the reefs, and what the islands and offshore waters mean to Native Hawaiians, conservationists, and commercial fishers.",
        },
      ],
      takeaways: [
        "Palmyra Atoll is a remote Pacific atoll about a thousand miles south of Hawaii.",
        "It is part of four protected U.S. marine monuments described as the country’s largest environmental conservation area.",
        "The notes describe a thriving ecosystem of birds, marine life, and one of the most pristine coral reefs in the world.",
        "No people live on Palmyra full time, and journalist access is described as rare.",
        "NPR’s Lauren Sommer visited and tells host Ayesha Rascoe about wildlife, reefs, and what the waters mean to Native Hawaiians, conservationists, and commercial fishers.",
        "Official notes say the Trump administration is trying to open nearby waters to commercial fishing.",
      ],
      spokenRecap:
        "Up First from NPR. A visit to the remote Pacific island ecosystem losing protections. Guest: Lauren Sommer. NPR’s Lauren Sommer reports from Palmyra Atoll, a remote Pacific conservation area about a thousand miles south of Hawaii, and talks with host Ayesha Rascoe about what she saw there. Official show notes say the Trump administration is trying to roll back longstanding protections by opening nearby waters to commercial fishing. Palmyra is part of four protected U.S. marine monuments, with birds, marine life, and one of the most pristine coral reefs in the world. No one lives there full time, and journalist access is rare. Sommer and Rascoe discuss the wildlife, reefs, and what the islands and offshore waters mean to Native Hawaiians, conservationists, and commercial fishers.",
      sourceType: "shownotes" as const,
      confidenceNote:
        "This brief is based on official show notes, not a full transcript. Quotes and topics not present in the notes were not added.",
      guest: "Lauren Sommer",
    } satisfies SeedBrief,
  },
  {
    id: "seed_ep_planetmoney_sasquatch",
    showId: "seed_show_planetmoney",
    guid: "b23000fa-66fb-4df2-a3be-455bf17c5477",
    title: "Who decides what big box sells? Our GAME got us answers",
    publishedAt: new Date("2026-08-21T21:17:27.000Z"),
    link: "https://www.npr.org/2026/08/21/nx-s1-5940897/buyer-boardgame-bigbox-target-walmart",
    audioUrl: null,
    description:
      "There’s a room where the fates of retail products are decided. Will they make it onto the shelves of the big box stores? Usually the rest of us can’t get inside the room where decisions are made – until now! Today on the show, we pitch the Planet Money game, Sell Me a Sasquatch, to big box retailers. We go behind the scenes to learn about how products end up on big box store shelves, what’s going on inside the minds of the deciders, and find out our board game’s fate.",
    guest: null,
    brief: {
      overview:
        "Planet Money goes into the room where retailers decide which products reach big-box shelves. The hosts pitch their own board game, Sell Me a Sasquatch, to learn how those decisions are made and what happens to their game.",
      segments: [
        {
          title: "The room where products live or die",
          speaker: "host" as const,
          summary:
            "Official notes say there is a room where the fates of retail products are decided — whether they make it onto big-box shelves — and that outsiders usually cannot get in.",
        },
        {
          title: "Pitching Sell Me a Sasquatch",
          speaker: "host" as const,
          summary:
            "The show pitches the Planet Money game Sell Me a Sasquatch to big-box retailers as a way inside that process.",
        },
        {
          title: "How buyers decide",
          speaker: "unknown" as const,
          summary:
            "They go behind the scenes to learn how products end up on big-box shelves and what is going on inside the minds of the deciders.",
        },
        {
          title: "The game’s fate",
          speaker: "host" as const,
          summary:
            "The episode also reports what happened to Planet Money’s board game after that pitch. The notes do not name a final retailer decision beyond saying they find out the game’s fate.",
        },
      ],
      takeaways: [
        "Big-box shelf space is decided in a room most people never see.",
        "Planet Money used its own board game, Sell Me a Sasquatch, as the product being pitched.",
        "The episode looks at how products get onto big-box store shelves.",
        "It also looks at how retail buyers think when they say yes or no.",
        "The show follows the pitch through to the game’s fate; official notes do not spell out that outcome in writing.",
      ],
      spokenRecap:
        "Planet Money. Who decides what big box sells? Our GAME got us answers. Planet Money goes into the room where retailers decide which products reach big-box shelves. The hosts pitch their own board game, Sell Me a Sasquatch, to learn how those decisions are made and what happens to their game. Official notes say outsiders usually cannot get inside that room. The episode follows the pitch, the buyers’ thinking, and the game’s fate. The written show notes do not name the final decision.",
      sourceType: "shownotes" as const,
      confidenceNote:
        "This brief is based on official show notes, not a full transcript. Quotes and topics not present in the notes were not added.",
      guest: null,
    } satisfies SeedBrief,
  },
] as const;
