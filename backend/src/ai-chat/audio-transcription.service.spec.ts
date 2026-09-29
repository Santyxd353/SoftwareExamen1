import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AudioTranscriptionService } from './audio-transcription.service';

const audioFile = {
  buffer: Buffer.from('recorded-audio'),
  mimetype: 'audio/webm',
  originalname: 'dictation.webm',
  size: 14,
};

describe('AudioTranscriptionService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('can be created by Nest with only its production dependency', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AudioTranscriptionService,
        { provide: ConfigService, useValue: { get: () => 'test-key' } },
      ],
    }).compile();

    expect(module.get(AudioTranscriptionService)).toBeInstanceOf(AudioTranscriptionService);
  });

  it('returns trimmed Groq Whisper transcription', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ text: '  crea una clase producto  ' }),
    } as any);
    const service = new AudioTranscriptionService(
      { get: (key: string) => key === 'GROQ_API_KEY' ? 'test-key' : undefined } as any,
    );

    await expect(service.transcribe(audioFile, 'es')).resolves.toEqual({
      text: 'crea una clase producto',
    });

    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    const headers = options.headers as Record<string, string>;
    const body = options.body as FormData;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(body.get('model')).toBe('whisper-large-v3-turbo');
    expect(body.get('language')).toBe('es');
  });

  it('fails safely when Groq is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'private-key' } }),
    } as any);
    const service = new AudioTranscriptionService(
      { get: () => 'test-key' } as any,
    );

    await expect(service.transcribe(audioFile, 'es')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('requires a configured Groq key', async () => {
    const service = new AudioTranscriptionService({ get: () => undefined } as any);

    await expect(service.transcribe(audioFile, 'es')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
