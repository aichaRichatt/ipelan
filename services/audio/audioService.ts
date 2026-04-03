import { Audio } from 'expo-av';

class AudioService {
  private sound: Audio.Sound | null = null;
  private isLoading: boolean = false;

  async playWord(): Promise<void> {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/storage/audio/audio.ogg'),
        { shouldPlay: true }
      );
      
      this.sound = sound;
      this.isLoading = false;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.stop();
        }
      });
    } catch (error) {
      console.warn('Audio playback failed:', error);
      this.isLoading = false;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.warn('Audio stop failed:', error);
    }
  }

  async playAndAutoStop(durationMs: number = 2000): Promise<void> {
    await this.playWord();
    setTimeout(async () => {
      await this.stop();
    }, durationMs);
  }
}

export const audioService = new AudioService();
