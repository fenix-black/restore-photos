interface ShareOptions {
  title: string;
  text: string;
  url: string;
  fallbackMessage: string;
}

export const shareContent = async (options: ShareOptions): Promise<void> => {
  // Check if Web Share API is supported
  if (navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
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
