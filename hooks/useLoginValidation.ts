import { useState } from 'react';

export function useLoginValidation() {
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const validateAll = (username: string, password: string) => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username || username.length < 3) {
      newErrors.username = "Le nom d'utilisateur doit avoir au moins 3 caractères";
    }

    if (!password || password.length < 6) {
      newErrors.password = "Le mot de passe doit avoir au moins 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validateAll };
}
