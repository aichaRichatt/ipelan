import { useState } from 'react';

export function useLoginValidation() {
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateAll = (email: string, password: string) => {
    const newErrors: { email?: string; password?: string } = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      newErrors.email = "Veuillez entrer une adresse email valide";
    }

    if (!password || password.length < 6) {
      newErrors.password = "Le mot de passe doit avoir au moins 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validateAll };
}
