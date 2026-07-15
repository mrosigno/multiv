import { useMemo } from 'react';

export function useAuthAccess() {
  return useMemo(() => {
    
    // Funzione globale di logout 
    const logout = () => {
      localStorage.removeItem('gestionale_auth');
      sessionStorage.removeItem('active_submenu');
      window.location.href = import.meta.env.BASE_URL || '/';
    };

    let authData: any = {};
    try {
      const raw = localStorage.getItem('gestionale_auth');
      if (raw === 'true') {
        // Backdoor storica per MROSIGNO
        return { 
          username: 'MROSIGNO', level: 10, isAdmin: true, 
          canAccessArea1: true, canAccessArea2: true, canAccessArea3: true, canAccessImpostazioni: true, 
          isReadOnly: false, canEdit: true, canCreate: true, canDelete: true, canAudit: true, token: 'bypass',
          magId: 1, logout
        };
      }
      authData = JSON.parse(raw || '{}');
    } catch (e) {}

    // Amministratore (Dirigente = S oppure Livello = 10)
    const isAdmin = authData.dirig === 'S' || Number(authData.level) === 10;
    const level = Number(authData.level || 1);

    // APPLICHIAMO LA TUA REGOLA N.4 (Infallibile su MySQL e Access)
    // Se il valore non è 0, allora è abilitato (copre -1, 1, "-1", "1")
    const checkArea = (val: any) => Number(val || 0) !== 0;

    return {
      username: authData.username || '',
      token: authData.device_token || '',
      magId: Number(authData.gruppo) || 1,
      isAdmin,
      level,
      
      // Controllo Aree sicuro 
      canAccessArea1: isAdmin || checkArea(authData.g1),
      canAccessArea2: isAdmin || checkArea(authData.g2),
      canAccessArea3: isAdmin || checkArea(authData.g3),
      canAccessImpostazioni: isAdmin, 

      // Permessi operativi in base al Livello
      isReadOnly: !isAdmin && level === 1,
      canEdit: isAdmin || level >= 2,
      canCreate: isAdmin || level >= 3,
      canDelete: isAdmin || level >= 8,
      canAudit: isAdmin || level >= 9,
      
      logout
    };
  }, []);
}