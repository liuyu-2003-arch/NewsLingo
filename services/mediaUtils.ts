
declare global {
  interface Window {
    jsmediatags: any;
  }
}

export const extractCoverFromMedia = async (file: File): Promise<File | null> => {
  if (file.type.startsWith('video')) {
    return extractVideoThumbnail(file);
  } else if (file.type.startsWith('audio')) {
    return extractAudioCover(file);
  }
  return null;
};

const extractVideoThumbnail = (file: File): Promise<File | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    // Capture at 2 seconds to avoid black frames at start
    video.currentTime = 2; 
    video.muted = true;
    video.preload = 'metadata';

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
              resolve(thumbFile);
            } else {
              resolve(null);
            }
            URL.revokeObjectURL(video.src);
          }, 'image/jpeg', 0.85);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.error("Thumbnail gen error", e);
        resolve(null);
      }
    };

    // Timeout safety in case video fails to load/seek
    const timeout = setTimeout(() => {
        resolve(null);
        if(video.src) URL.revokeObjectURL(video.src);
    }, 4000);

    video.onloadeddata = () => {
        // Trigger seek once loaded
        video.currentTime = 2;
    };
    
    video.onseeked = () => {
        clearTimeout(timeout);
        onSeeked();
    };
    
    video.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
    };
  });
};

const extractAudioCover = (file: File): Promise<File | null> => {
  return new Promise((resolve) => {
    if (!window.jsmediatags) {
        console.warn("jsmediatags library not loaded");
        resolve(null);
        return;
    }

    window.jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const picture = tag.tags.picture;
        if (picture) {
          const { data, format } = picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          const base64 = "data:" + format + ";base64," + window.btoa(base64String);
          
          fetch(base64)
            .then(res => res.blob())
            .then(blob => {
                const coverFile = new File([blob], "cover.jpg", { type: format });
                resolve(coverFile);
            })
            .catch((e) => {
                console.error("Error converting ID3 tag to file", e);
                resolve(null);
            });
        } else {
          resolve(null);
        }
      },
      onError: (error: any) => {
        console.warn("ID3 read error (no tag or unsupported format)", error);
        resolve(null);
      }
    });
  });
};
