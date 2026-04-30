import { createAudioPlayer } from 'expo-audio';

class AudioService {
  private player: ReturnType<typeof createAudioPlayer> | null = null;
  private isCurrentlyPlaying: boolean = false;

  /**
   * Lit un audio Moodle :
   *  1. Si une copie locale est disponible → lit depuis le disque (offline)
   *  2. Sinon lit en streaming et lance un download en arrière-plan pour
   *     l'usage offline futur (pas de blocage de la lecture)
   */
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

    // Vérifier la présence d'une copie locale (cache offline)
    try {
      // Import dynamique pour éviter les cycles d'import
      const { downloadService } = await import('../sync/downloadService');
      // Cache key sans le token (le token change selon l'utilisateur)
      const cacheKey = url.split('?')[0];
      const localUri = await downloadService.getLocalUri(cacheKey);

      if (localUri) {
        await this.playUri(localUri);
        return;
      }

      // Lecture streaming + déclenchement asynchrone du download (fire-and-forget)
      await this.playUri(url);
      downloadService.downloadAudio(url).catch(() => {
        // Cache offline best-effort
      });
      return;
    } catch {
      // Si le cache échoue, lecture distante seule
      await this.playUri(url);
    }
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

  /**
   * Joue l'audio courant puis l'arrête automatiquement après `durationMs`.
   * Utile pour des feedback courts (ex. son de bonne réponse).
   * Si aucun audio n'est en cours, ne fait rien.
   */
  async playAndAutoStop(durationMs: number = 2000): Promise<void> {
    if (!this.player) return;
    try {
      this.player.play();
      this.isCurrentlyPlaying = true;
      await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, durationMs)));
      await this.stop();
    } catch (error) {
      this.isCurrentlyPlaying = false;
      console.warn('Audio auto-stop failed:', error);
    }
  }

  get playing(): boolean {
    return this.isCurrentlyPlaying;
  }
}

export const audioService = new AudioService();
