import type { Personality } from './types';

/*
 * What a monster says when something happens. Short, optional, aimed at the class as a team and
 * never at a student: no names, no "you got it wrong", nothing a child could take personally. When the
 * class has a bad round the monster gloats about its own luck, never calls the class weak or slow.
 * The battle shows at most one line per question.
 */

export type Moment = 'intro' | 'classStrong' | 'classWeak' | 'comeback' | 'rage' | 'weakened' | 'defeated';

export type PersonalityInfo = {
  label: string;
  /** Motion timing: a sleepy giant moves slowly, a mischievous shade quickly (1 = normal). */
  tempo: number;
  lines: Record<Moment, readonly string[]>;
};

export const PERSONALITIES: Record<Personality, PersonalityInfo> = {
  arrogant: {
    label: 'Arrogant',
    tempo: 1,
    lines: {
      intro: ['Bow before me, little scholars.', 'You think books can harm me?'],
      classStrong: ['Impossible… a lucky strike.', 'That… actually stung.'],
      classWeak: ['Ha! You missed me.', 'My armour holds… for now.'],
      comeback: ['What? Where did that come from?', 'No… you were losing!'],
      rage: ['ENOUGH! Now I am angry.', 'You dare?!'],
      weakened: ['This cannot be happening…', 'My crown… is slipping.'],
      defeated: ['Beaten… by a classroom?!'],
    },
  },
  furious: {
    label: 'Furious',
    tempo: 1.15,
    lines: {
      intro: ['GRRRAAH!', 'SMASH THE CLEVER ONES!'],
      classStrong: ['RAAAGH! That hurt!', 'STOP KNOWING THINGS!'],
      classWeak: ['HA! MISSED ME!', 'GRR! MY TURN!'],
      comeback: ['HUH?!', 'WHERE DID THEY LEARN THAT?!'],
      rage: ['NOW I AM REALLY ANGRY!', 'RAAAAAAGH!'],
      weakened: ['…tired… so tired…', 'Grr… legs… wobbly…'],
      defeated: ['…not… fair…'],
    },
  },
  cunning: {
    label: 'Cunning',
    tempo: 1.05,
    lines: {
      intro: ['Let us play a little game of wits.', 'I know every trick question.'],
      classStrong: ['Clever. Very clever.', 'You saw through that one.'],
      classWeak: ['Fooled you! Think again.', 'My riddles are working…'],
      comeback: ['Oh? You learned from that.', 'I did not plan for this.'],
      rage: ['No more games.', 'Time for my best trick.'],
      weakened: ['My tricks are running out…', 'Perhaps I underestimated you.'],
      defeated: ['Outwitted… well played.'],
    },
  },
  sleepy: {
    label: 'Sleepy but dangerous',
    tempo: 0.8,
    lines: {
      intro: ['*yawn* Who woke me up?', 'Five more minutes…'],
      classStrong: ['Ow! Now I am awake.', 'Hey, that tickles… a lot.'],
      classWeak: ['*snore*… too easy…', 'Wake me when you know the answer.'],
      comeback: ['Wait, what did I miss?', 'Now you have my attention.'],
      rage: ['I am WIDE awake now.', 'You ruined my nap!'],
      weakened: ['Need… a… nap…', 'So… sleepy…'],
      defeated: ['Goodnight… for good…'],
    },
  },
  mischievous: {
    label: 'Mischievous',
    tempo: 1.2,
    lines: {
      intro: ['Hee hee! New friends to trick!', 'I ate the last class’s homework.'],
      classStrong: ['Hey! No fair!', 'Yowch! Who taught you that?'],
      classWeak: ['Hee hee! Got you!', 'Wrong way! This way!'],
      comeback: ['Uh oh…', 'That was not supposed to happen!'],
      rage: ['Now I am cross!', 'No more Mr Nice Monster!'],
      weakened: ['Okay, okay, truce?', 'I give up… almost.'],
      defeated: ['Fine! You win! This time…'],
    },
  },
  ancient: {
    label: 'Ancient and intimidating',
    tempo: 0.9,
    lines: {
      intro: ['I have waited a thousand years.', 'Prove what you have learned.'],
      classStrong: ['Your knowledge burns.', 'The young ones learn quickly.'],
      classWeak: ['The old riddles still hold.', 'I have stood a thousand years.'],
      comeback: ['So, you remember after all.', 'A worthy recovery.'],
      rage: ['Feel the weight of ages!', 'Enough. I rise.'],
      weakened: ['My age… betrays me.', 'The long sleep calls.'],
      defeated: ['At last… I may rest.'],
    },
  },
  proud: {
    label: 'Proud',
    tempo: 1,
    lines: {
      intro: ['Face me with honour.', 'Only the wise may pass.'],
      classStrong: ['A worthy blow.', 'You fight with knowledge. Good.'],
      classWeak: ['I still stand. Try again!', 'A fine try, challengers.'],
      comeback: ['You rally! Impressive.', 'Now this is a battle.'],
      rage: ['Then I shall fight in earnest!', 'No more holding back!'],
      weakened: ['I… will not kneel…', 'You have earned my respect.'],
      defeated: ['You are worthy. I yield.'],
    },
  },
  sinister: {
    label: 'Sinister',
    tempo: 0.95,
    lines: {
      intro: ['Your doubts will feed me.', 'Darkness gathers…'],
      classStrong: ['The light… it burns.', 'Hssss… knowledge.'],
      classWeak: ['The shadows grow stronger.', 'Hsss… you missed.'],
      comeback: ['The light returns? No…', 'How are you still standing?'],
      rage: ['Now the shadows rise!', 'You will regret that.'],
      weakened: ['Fading… into dark…', 'Not… like this…'],
      defeated: ['The shadows… retreat…'],
    },
  },
};

/** One line for a moment, picked the same way on every screen (no randomness at play time). */
export function battleLine(personality: Personality, moment: Moment, seed: number, turn = 0): string {
  const lines = PERSONALITIES[personality].lines[moment];
  return lines[Math.abs(seed + turn * 7) % lines.length];
}
