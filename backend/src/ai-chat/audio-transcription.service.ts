import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
]);

@Injectable()
export class AudioTranscriptionService {
  constructor(private readonly config: ConfigService) {}

  async transcribe(file: UploadedAudio, locale = 'es'): Promise<{ text: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required');
    if (!SUPPORTED_AUDIO_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Unsupported audio format');
    }

    const apiKey = this.config.get<string>('GROQ_API_KEY')?.trim();
    if (!apiKey) throw new ServiceUnavailableException('Audio transcription is not configured');

    const form = new FormData();
    const bytes = new Uint8Array(file.buffer);
    form.append('file', new Blob([bytes], { type: file.mimetype }), file.originalname || 'dictation.webm');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', locale.toLowerCase().startsWith('es') ? 'es' : 'en');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    let response: Response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch {
      throw new BadGatewayException('Audio transcription provider is unreachable');
    }

    if (!response.ok) {
      throw new BadGatewayException(`Audio transcription failed (${response.status})`);
    }

    const payload = await response.json();
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) throw new BadGatewayException('Audio transcription returned no text');
    return { text };
  }
}
