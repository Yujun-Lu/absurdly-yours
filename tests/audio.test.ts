import test from "node:test";
import assert from "node:assert/strict";
import { encodeWav, resampleMono } from "../lib/audio.ts";
import { findSampleResult, getSample } from "../lib/samples.ts";

test("WAV header matches real one-second 48k to 16k mono PCM conversion", () => {
  const samples = new Float32Array(48000).fill(0.5);
  const wav = encodeWav(samples, 48000);
  const header = new DataView(wav);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(wav.slice(8, 12)), "WAVE");
  assert.equal(header.getUint16(22, true), 1);
  assert.equal(header.getUint32(24, true), 16000);
  assert.equal(header.getUint16(34, true), 16);
  assert.equal(header.getUint32(40, true), 32000);
  assert.equal(wav.byteLength, 32044);
  assert.equal(header.getInt16(44, true), 16384);
});

test("resampling averages source frames rather than relabelling or dropping them", () => {
  const source = Float32Array.from([1, -1, 0.5, 1, -1, 0.5]);
  const pcm = resampleMono(source, 48000, 16000);
  assert.equal(pcm.length, 2);
  assert.ok(Math.abs(pcm[0] - 1 / 6) < 1e-6);
  assert.ok(Math.abs(pcm[1] - 1 / 6) < 1e-6);
  assert.equal(resampleMono(new Float32Array(44100), 44100).length, 16000);
});

test("WAV encoding clamps out-of-range input and contains non-finite samples", () => {
  const view = new DataView(encodeWav(Float32Array.from([-2, 2, NaN]), 16000));
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), 0);
  assert.throws(() => resampleMono(new Float32Array(2), 0), /INVALID_SAMPLE_RATE/);
});

test("samples never fabricate a result for edited or custom input", () => {
  const sample = getSample("rewrite", "en");
  const request = { text: sample.input, mode: "rewrite" as const, locale: "en" as const, flair: 1 as const };
  assert.equal(findSampleResult(request)?.body, sample.results[1].body);
  assert.equal(findSampleResult({ ...request, text: sample.input + " Actually, seven meetings." }), null);
  assert.equal(findSampleResult({ ...request, locale: "zh" }), null);
  assert.notEqual(sample.results[1].body, sample.results[2].body);
  assert.notEqual(sample.results[2].body, sample.results[3].body);
});

test("every language and mode has a matched sample, including both bulletin templates", () => {
  for (const locale of ["en", "zh"] as const) {
    for (const mode of ["rewrite", "poetry", "bulletin", "diary", "reply"] as const) {
      const sample = getSample(mode, locale);
      assert.ok(sample.input.length > 0);
      assert.ok(findSampleResult({ text: sample.input, mode, locale, flair: 1 })?.body);
    }
    const bulletin = getSample("bulletin", locale, "bulletin");
    const award = getSample("bulletin", locale, "award");
    assert.notEqual(bulletin.id, award.id);
    assert.ok(award.results[1].title);
    assert.ok(award.results[1].body);
    assert.ok(bulletin.results[1].title);
    assert.ok(bulletin.results[1].footer);
  }
});
