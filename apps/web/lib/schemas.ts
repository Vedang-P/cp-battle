/**
 * Shared validation schemas (zod). Reused by API routes and client forms so
 * the rules can never drift between them.
 */

import { z } from 'zod';

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN = 8;

// Disposable email domain blocklist
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'dispostable.com', 'maildrop.cc',
  'temp-mail.org', 'tempmailo.com', 'temp-mail.io', 'tempail.com',
  'tempr.email', 'tempenv.com', 'throwaway.email', 'discard.email',
  'discardmail.com', 'disposableemailaddresses.emailmiser.com',
  'tempinbox.com', 'tempinbox.co.uk', 'mailexpire.com', 'mailme.ir',
  'mailnull.com', 'mailscrap.com', 'mailshell.com', 'mailsiphon.com',
  'mailslurp.com', 'mailzilla.com', 'meltmail.com', 'nospam.ze.tc',
  'nomail.xl.cx', 'nospam4.us', 'nowmymail.com', 'reallymymail.com',
  'recode.me', 'rhyta.com', 'rklips.com', 'rmqkr.net',
  'safetymail.info', 'sandelf.de', 'saynotospams.com', 'scatmail.com',
  'skeefmail.com', 'slaskpost.se', 'slipry.net', 'sibmail.com',
  'sinnlos-mail.de', 'skeefmail.com', 'slutty.horse', 'smashmail.de',
  'smtp.mailgun.org', 'sofimail.com', 'sofort-mail.de', 'solarflare.dev',
  'sogetthis.com', 'soodonims.com', 'spam.la', 'spam.su',
  'spam4.me', 'spamavert.com', 'spambob.com', 'spambob.net',
  'spambob.org', 'spambog.com', 'spambog.de', 'spambog.ru',
  'spambox.info', 'spambox.irishspringrealty.com', 'spambox.us',
  'spamcannon.com', 'spamcannon.net', 'spamcero.com', 'spamcorptastic.com',
  'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org', 'spamday.com',
  'spamex.com', 'spamfighter.cf', 'spamfighter.ga', 'spamfighter.gq',
  'spamfighter.ml', 'spamfighter.tk', 'spamfree24.com', 'spamfree24.de',
  'spamfree24.eu', 'spamfree24.info', 'spamfree24.net', 'spamfree24.org',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'spamherelots.com',
  'spamhereplease.com', 'spamhole.com', 'spamify.com', 'spaminator.de',
  'spaml.com', 'spaml.de', 'spammotel.com', 'spamobox.com',
  'spamoff.de', 'spamslicer.com', 'spamspot.com', 'spamstack.net',
  'spamthis.co.uk', 'spamthisplease.com', 'spamtrail.com', 'spamtrap.ro',
  'speed.1s.fr', 'spoofmail.de', 'stuffmail.de', 'superrito.com',
  'superstachel.de', 'suremail.info', 'svk.jp', 'sweetxxx.de',
  'tafmail.com', 'tagyoureit.com', 'talkinator.com', 'tapchicuoihoi.com',
  'teewars.org', 'teleworm.com', 'teleworm.us', 'temp-mail.org',
  'temp-mail.io', 'temp-mail.ru', 'tempalias.com', 'tempe17.com',
  'tempemail.biz', 'tempemail.co.za', 'tempemail.com', 'tempemail.net',
  'tempinbox.com', 'tempmail.eu', 'tempmail.it', 'tempmailo.com',
  'tempmailer.com', 'tempmailer.de', 'tempomail.fr', 'temporarily.de',
  'tempthe.net', 'thankyou2010.com', 'thc.st', 'thecloudindex.com',
  'thetempmail.com', 'throwawayemailaddress.com', 'tittbit.in',
  'tizi.com', 'tmailinator.com', 'toiea.com', 'toomail.biz',
  'topranklist.de', 'tradermail.info', 'trash-ymail.org', 'trashemail.de',
  'trashmail.at', 'trashmail.com', 'trashmail.de', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.ws', 'trashmailer.com',
  'trashymail.com', 'trashymail.net', 'trillianpro.com', 'turual.com',
  'twinmail.de', 'tyldd.com', 'uggsrock.com', 'umail.net',
  'upliftnow.com', 'uplipht.com', 'venompen.com', 'veryreally.io',
  'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net', 'viewcastmedia.org',
  'vomoto.com', 'vpn.st', 'vsimcard.com', 'vubby.com',
  'wasteland.rfc822.org', 'webemail.me', 'weg-werf-email.de', 'wegwerfadresse.de',
  'wegwerfemail.com', 'wegwerfemail.de', 'wegwerfemail.net', 'wegwerfemail.org',
  'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whatiaas.com', 'whatpaas.com',
  'whyspam.me', 'wikidocuslice.com', 'willhackforfood.biz', 'willselfdestruct.com',
  'winemaven.info', 'wronghead.com', 'wuzup.net', 'wuzupmail.net',
  'wwwnew.eu', 'xagloo.com', 'xemaps.com', 'xents.com',
  'xjoi.com', 'xmaily.com', 'xoxy.net', 'yapped.net',
  'yeah.net', 'yep.it', 'yogamaven.com', 'yomail.info',
  'yopmail.com', 'yopmail.fr', 'yopmail.gq', 'yopmail.net',
  'yourdomain.com', 'ypmail.webarnak.fr', 'yuurok.com', 'zehnminutenmail.de',
  'zippymail.info', 'zoaxe.com', 'zoemail.org',
]);

export const signinSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .max(20, 'At most 20 characters')
      .regex(USERNAME_RE, 'Letters, numbers, underscores only'),
    email: z
      .string()
      .email('Enter a valid email')
      .refine(
        (email) => {
          const domain = email.split('@')[1]?.toLowerCase();
          return domain ? !DISPOSABLE_DOMAINS.has(domain) : false;
        },
        { message: 'Disposable email addresses are not allowed' }
      ),
    password: z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`),
  })
  .strict();

/** Public-safe user shape returned by auth + profile endpoints. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}
