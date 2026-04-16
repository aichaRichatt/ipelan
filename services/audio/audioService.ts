import { createAudioPlayer } from 'expo-audio';

class AudioService {
  private player: ReturnType<typeof createAudioPlayer> | null = null;
  private isCurrentlyPlaying: boolean = false;

  async playRemoteUrl(rawUrl: string, token: string): Promise<void> {
    let url = rawUrl;
    
    if (url.includes('forceddownload')) {
      url = url.replace(/[?&]forceddownload=1/gi, '');
      while (url.endsWith('?') || url.endsWith('&')) {
        url = url.slice(0, -1);
      }
    }
    
    if (!url.includes('token=') && !url.includes('wstoken=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}token=${token}`;
    }

    await this.playUri(url);
  }

  async playLocalUri(uri: string): Promise<void> {
    await this.playUri(uri);
  }

  private async playUri(uri: string): Promise<void> {
    try {
      if (this.player) {
        await this.player.pause();
        this.player.remove();
        this.player = null;
      }

      this.player = createAudioPlayer({ uri });
      this.isCurrentlyPlaying = true;
      this.player.play();
    } catch (error) {
      this.isCurrentlyPlaying = false;
      console.warn('Audio playback failed:', error);
    }
  }

  async playWord(uri?: string): Promise<void> {
    if (uri) {
      await this.playUri(uri);
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.player) {
        await this.player.pause();
        await this.player.seekTo(0);
        this.isCurrentlyPlaying = false;
      }
    } catch (error) {
      console.warn('Audio stop failed:', error);
    }
  }

  async pause(): Promise<void> {
    try {
      if (this.player && this.isCurrentlyPlaying) {
        await this.player.pause();
        this.isCurrentlyPlaying = false;
      }
    } catch (error) {
      console.warn('Audio pause failed:', error);
    }
  }

  async resume(): Promise<void> {
    try {
      if (this.player && !this.isCurrentlyPlaying) {
        this.player.play();
        this.isCurrentlyPlaying = true;
      }
    } catch (error) {
      console.warn('Audio resume failed:', error);
    }
  }

  async playAndAutoStop(durationMs: number = 2000): Promise<void> {
    return;
  }

  get playing(): boolean {
    return this.isCurrentlyPlaying;
  }
}

export const audioService = new AudioService();
