import { useState } from 'react';
import { LoginForm, FormErrors } from '../types';

export function useLoginValidation() {
  const [errors, setErrors] = useState<FormErrors<LoginForm>>({});

  const validateAll = (username: string, password: string) => {
    const newErrors: FormErrors<LoginForm> = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!username || !emailRegex.test(username)) {
      newErrors.username = "Veuillez entrer une adresse email valide";
    }

    if (!password || password.length < 6) {
      newErrors.password = "Le mot de passe doit avoir au moins 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validateAll };
}
