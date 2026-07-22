/**
 * Google Drive Backup & Sync Service
 * Implements client-side Google Drive API v3 integration using standard Fetch.
 */

const GDRIVE_FILE_NAME = 'profasist_backup.json';

export interface GDriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Generate Google OAuth 2.0 Implicit Flow Auth URL
 */
export function getAuthUrl(clientId: string, redirectUri: string): string {
  const scope = 'https://www.googleapis.com/auth/drive.file';
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
}

/**
 * Extract OAuth Access Token from URL Hash if present
 */
export function parseTokenFromHash(): { accessToken: string; expiresIn: string } | null {
  if (!window.location.hash) return null;

  try {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in') || '3600';

    if (accessToken) {
      // Clear hash from address bar for a clean URL
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return { accessToken, expiresIn };
    }
  } catch (e) {
    console.error('Error parsing token from hash:', e);
  }
  return null;
}

/**
 * Search for the backup file in Google Drive
 */
export async function searchBackupFile(token: string): Promise<GDriveFileInfo | null> {
  const url = `https://www.googleapis.com/drive/v3/files?q=name='${GDRIVE_FILE_NAME}' and trashed=false&fields=files(id, name, modifiedTime, size)&spaces=drive`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    const errText = await res.text();
    throw new Error(`Error al buscar archivo en Drive: ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: file.size
    };
  }
  return null;
}

/**
 * Upload backup payload to Google Drive (Creates new file or Updates existing one)
 */
export async function uploadBackup(
  token: string, 
  backupPayload: any, 
  existingFileId: string | null
): Promise<{ fileId: string; modifiedTime: string }> {
  
  if (existingFileId) {
    // UPDATE EXISTING FILE
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupPayload)
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      const errText = await res.text();
      throw new Error(`Error al actualizar respaldo en Drive: ${errText}`);
    }

    const updatedFile = await res.json();
    
    // Get latest file metadata (modifiedTime)
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${existingFileId}?fields=id,modifiedTime`;
    const metaRes = await fetch(metaUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const metaData = metaRes.ok ? await metaRes.json() : {};

    return {
      fileId: updatedFile.id || existingFileId,
      modifiedTime: metaData.modifiedTime || new Date().toISOString()
    };
  } else {
    // CREATE NEW FILE (Multipart upload: Metadata + Media)
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: GDRIVE_FILE_NAME,
      mimeType: 'application/json',
      description: 'Copia de seguridad automática de Asistencia Docente ProfAsist'
    };

    const boundary = 'profasist_gdrive_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(backupPayload) +
      closeDelimiter;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      const errText = await res.text();
      throw new Error(`Error al crear respaldo en Drive: ${errText}`);
    }

    const newFile = await res.json();
    
    // Get latest file metadata (modifiedTime)
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${newFile.id}?fields=id,modifiedTime`;
    const metaRes = await fetch(metaUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const metaData = metaRes.ok ? await metaRes.json() : {};

    return {
      fileId: newFile.id,
      modifiedTime: metaData.modifiedTime || new Date().toISOString()
    };
  }
}

/**
 * Download backup payload from Google Drive
 */
export async function downloadBackup(token: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const errText = await res.text();
    throw new Error(`Error al descargar respaldo de Drive: ${errText}`);
  }

  return await res.json();
}
