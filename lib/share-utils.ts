interface ShareOptions {
  title: string;
  text: string;
  url: string;
  fallbackMessage: string;
  files?: File[];
}

export const shareContent = async (options: ShareOptions): Promise<void> => {
  // Check if Web Share API is supported
  if (navigator.share) {
    try {
      const shareData: ShareData = {
        title: options.title,
        text: options.text,
        url: options.url,
      };
      
      // Add files if provided and if the browser supports file sharing
      if (options.files && options.files.length > 0 && navigator.canShare && navigator.canShare({ files: options.files })) {
        shareData.files = options.files;
      }
      
      await navigator.share(shareData);
      return;
    } catch (error) {
      // User cancelled or sharing failed, fall through to fallback
      console.log('Web Share API failed or was cancelled:', error);
    }
  }

  // Fallback: Try to copy to clipboard and show message
  try {
    const shareText = `${options.text} ${options.url}`;
    await navigator.clipboard.writeText(shareText);
    
    // Show a temporary toast or alert
    if (window.confirm(`${options.fallbackMessage}\n\n"${shareText}"\n\nCopied to clipboard! Click OK to continue.`)) {
      // User acknowledged
    }
  } catch (error) {
    // Clipboard API failed, show manual copy dialog
    const shareText = `${options.text} ${options.url}`;
    prompt(options.fallbackMessage, shareText);
  }
};

export const createPhotoShareOptions = (
  shareMessage: string,
  shareUrl: string,
  shareTitle: string,
  fallbackMessage: string
): ShareOptions => ({
  title: shareTitle,
  text: shareMessage,
  url: shareUrl,
  fallbackMessage,
});

export const createVideoShareOptions = (
  shareMessage: string,
  shareUrl: string,
  shareTitle: string,
  fallbackMessage: string
): ShareOptions => ({
  title: shareTitle,
  text: shareMessage,
  url: shareUrl,
  fallbackMessage,
});
