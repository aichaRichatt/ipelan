import { createAudioPlayer } from 'expo-audio';

class AudioService {
  private player: ReturnType<typeof createAudioPlayer> | null = null;

  async playWord(uri: string): Promise<void> {
    try {
      if (this.player) {
        await this.player.pause();
        this.player.remove();
        this.player = null;
      }

      this.player = createAudioPlayer({ uri });
      this.player.play();
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.player) {
        await this.player.pause();
        await this.player.seekTo(0);
      }
    } catch (error) {
      console.warn('Audio stop failed:', error);
    }
  }

  async playAndAutoStop(durationMs: number = 2000): Promise<void> {
    return;
  }
}

export const audioService = new AudioService();
