switch (extension.placement) {
    case 'before':
    case 'after':
    case 'prepend':
    case 'append':
      var extensionHtml = document.getElementById('optimizely-extension-' + extension.$instance);
      if (extensionHtml) {
        extensionHtml.parentElement.removeChild(extensionHtml);
      }
      break;
    case 'replace-content':
      var origHtml = '#optimizely-extension-' + extension.$instance + '-orig'.innerHTML;
      (extension.selector).innerHTML = origHtml;
      break;
    default:
      throw new Error('Unknown placement ' + extension.placement);
  }
  