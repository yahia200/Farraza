import { allowedContentTypes, matchAllowedType } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import {
  sampleM4a,
  sampleM4aWithMp4Brand,
  sampleMov,
  sampleMovWithoutFileType,
  sampleMp3,
  sampleMp4,
  sampleOgg,
  sampleWav,
  sampleWebm,
  sampleZip,
} from '../testing/sample-files.js';
import { SNIFF_BYTES, sniffFileType } from './file-sniff.js';

// Ticket 09's verification step: does `file-type` (22.2.0) recognise every listed video and audio
// format from the leading bytes the submit-time check reads, and how does it name each? The names
// below are what it answered when this was written; the second half checks that each one is
// accepted for the right questions through `matchAllowedType`, which the service uses.

const videoTypes = allowedContentTypes(['video']);
const audioTypes = allowedContentTypes(['audio']);
const bothTypes = allowedContentTypes(['video', 'audio']);

describe('what file-type says about video and audio', () => {
  it.each([
    ['an MP4 (brand isom)', sampleMp4(), 'video/mp4'],
    ['a MOV (brand qt)', sampleMov(), 'video/quicktime'],
    ['a MOV with no ftyp box (starts with moov)', sampleMovWithoutFileType(), 'video/quicktime'],
    ['a WebM with a video track', sampleWebm('video'), 'video/webm'],
    ['a WebM with only an audio track', sampleWebm('audio'), 'video/webm'],
    ['an MP3 with no tag', sampleMp3(), 'audio/mpeg'],
    ['an MP3 with a small ID3 tag', sampleMp3({ id3Bytes: 2000 }), 'audio/mpeg'],
    ['an M4A (brand M4A)', sampleM4a(), 'audio/x-m4a'],
    ['an audio-only MP4 with brand mp42', sampleM4aWithMp4Brand(), 'video/mp4'],
    ['a WAV', sampleWav({ seconds: 1 }), 'audio/wav'],
    ['an OGG (Vorbis)', sampleOgg('vorbis'), 'audio/ogg'],
    ['an OGG (Opus)', sampleOgg('opus'), 'audio/ogg; codecs=opus'],
  ])('names %s', async (_label, bytes, mime) => {
    expect(await sniffFileType(bytes)).toBe(mime);
  });

  it('cannot tell a WebM with pictures from one with sound only, nor an MP4 from an M4A with an MP4 brand', async () => {
    // The consequence for the allowlist: video/webm and video/mp4 must be accepted for audio questions.
    expect(await sniffFileType(sampleWebm('audio'))).toBe(await sniffFileType(sampleWebm('video')));
  });
});

describe('big files: only the first SNIFF_BYTES are read', () => {
  it('recognises a large MP4 and MOV, whose ftyp box is the first thing in the file', async () => {
    const mp4 = sampleMp4({ extraBytes: 4 * SNIFF_BYTES });
    const mov = sampleMov({ extraBytes: 4 * SNIFF_BYTES });
    expect(mp4.length).toBeGreaterThan(SNIFF_BYTES * 4);
    expect(await sniffFileType(mp4.subarray(0, SNIFF_BYTES))).toBe('video/mp4');
    expect(await sniffFileType(mov.subarray(0, SNIFF_BYTES))).toBe('video/quicktime');
  });

  it('recognises an MP3 whose ID3 tag (cover art) is bigger than the slice read', async () => {
    const mp3 = sampleMp3({ id3Bytes: 3 * SNIFF_BYTES });
    expect(await sniffFileType(mp3.subarray(0, SNIFF_BYTES))).toBe('audio/mpeg');
  });

  it('recognises a WAV, OGG and WebM from their first bytes alone', async () => {
    expect(await sniffFileType(sampleWav({ seconds: 20 }).subarray(0, SNIFF_BYTES))).toBe('audio/wav');
    expect(await sniffFileType(sampleOgg().subarray(0, 64))).toBe('audio/ogg');
    expect(await sniffFileType(sampleWebm().subarray(0, 64))).toBe('video/webm');
  });
});

describe('what a question accepts, by the type file-type reports', () => {
  it.each([
    ['video/mp4', videoTypes, 'video/mp4'],
    ['video/quicktime', videoTypes, 'video/quicktime'],
    ['video/webm', videoTypes, 'video/webm'],
    ['audio/mpeg', audioTypes, 'audio/mpeg'],
    ['audio/x-m4a', audioTypes, 'audio/mp4'],
    ['audio/wav', audioTypes, 'audio/wav'],
    ['audio/ogg', audioTypes, 'audio/ogg'],
    ['audio/ogg; codecs=opus', audioTypes, 'audio/ogg'],
    // A WebM or MP4 is one audio-only files share with video: either kind's question takes it.
    ['video/webm', audioTypes, 'audio/webm'],
    ['video/mp4', audioTypes, 'audio/mp4'],
    ['video/webm', bothTypes, 'video/webm'],
  ])('%s is accepted as %s', (sniffed, allowed, stored) => {
    expect(matchAllowedType(allowed, sniffed)).toBe(stored);
  });

  it.each([
    ['audio/x-m4a', videoTypes], // an M4A is not a video
    ['audio/mpeg', videoTypes],
    ['video/quicktime', audioTypes], // a MOV is not an audio file
    ['video/ogg', audioTypes], // Theora video in Ogg is not "OGG" audio
    ['application/ogg', audioTypes], // an Ogg whose codec file-type could not tell
    ['video/x-matroska', videoTypes], // MKV is a sibling of WebM, not WebM
    ['video/mp2t', videoTypes],
    ['video/3gpp', videoTypes],
    ['audio/aac', audioTypes],
    ['audio/flac', audioTypes],
    ['application/zip', bothTypes],
  ])('%s is refused for %j', (sniffed, allowed) => {
    expect(matchAllowedType(allowed, sniffed)).toBeNull();
  });

  it('refuses a zip renamed .mp4 by its bytes', async () => {
    const sniffed = await sniffFileType(sampleZip());
    expect(matchAllowedType(videoTypes, sniffed ?? '')).toBeNull();
  });
});
