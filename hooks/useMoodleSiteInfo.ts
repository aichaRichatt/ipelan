import { getCurrentUserSiteInfo } from '@/services/api/moodleAuth';
import { useEffect, useState } from 'react';

export function useMoodleSiteInfo() {
    const [siteInfo, setSiteInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadSiteInfo = async () => {
            setLoading(true);
            setError(null);

            try {
                const info = await getCurrentUserSiteInfo();
                if (isMounted) {
                    setSiteInfo(info);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.message || 'Impossible de récupérer les informations Moodle');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadSiteInfo();

        return () => {
            isMounted = false;
        };
    }, []);

    return { siteInfo, loading, error };
}
