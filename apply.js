// Throughout this script there will be places marked as [MUST CHANGE]. Make sure you fill in the details accordingly.
// Other places have comments to inform you what kind of customizations you can potentially make there. Make sure you
// read through them.

// jQuery is not required anymore for this extension
var utils = optimizely.get('utils');
var recommender = optimizely.get('recommender');

// This boolean tells whether you are in the editor, so that you can special case if needed.
var editorMode = !!window.optimizely_p13n_inner ||
    window.location != window.parent.location &&
    window.location.search.indexOf('optimizely_editor') > -1,
    logEnabled = editorMode || window.localStorage.getItem('logRecs');

var log = function() {
  if(logEnabled) console.log.apply(console, arguments);
};

// [MUST CHANGE]
// Fill in the real ids of the different recommenders you will use
var recommenderIds = {
    "co-browse": 0,
    "co-buy": 0,
    "popular": 0,
    "user-based": 0
};
var recommenderKey = {
    recommenderServiceId: 0,
    recommenderId: recommenderIds[extension.algorithm]
};

// [MUST CHANGE]
// Replace with the actual id tag name of the recommender service.
var idTagName = 'id';

function getTargetId() {
  // [MUST CHANGE]
  // Replace with actual code to retrieve the id of the target entity to recommend for.
  //
  // * For most-popular algorithms, this should be a fixed value of 'popular'.
  // * For user-based algorithms, this will be the optimizely visitor id which you can get through this code:
  //   optimizely.get('visitor').visitorId
  // * For item-based algorithms such as co-browse and co-buy, this will be the target item id.
  //
  switch (extension.algorithm) {
      case 'popular':
        return 'popular';
        break;
      case 'user-based':
        return optimizely.get('visitor').visitorId;
        break;
      case 'co-browse':
      case 'co-buy':
        // [MUST CHANGE]
        // return the target item ID (product ID/SKU)
        break;
      default:
        return 'popular';
    }
}

function preFilter(reco) {
  // Use this function to filter on these fields:
  // * id (keyed by idTagName)
  // * _score (usually a value between 0 and 1)
  return true;
}

function canonicalize(reco) {
  log('canonicalize', reco);

  // This is where you perform any necessary canonicalization of the recos before rendering them.
  // In the example below, we convert numeric prices into string form, and treat missing in_stock values as true.
  if (typeof reco.price === 'number') {
    // [MUST CHANGE] if this is for a different currency and/or locale.
    var symbol = '$';
    var locale = 'en-US';
    reco.price = symbol + (reco.price / 100.0).toLocaleString(
      locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof reco.in_stock === 'undefined') {
    reco.in_stock = true;
  }

  return reco;
}

function postFilter(reco) {
  // Use this function to filter on other metadata fields not covered in preFilter().
  // In this example, we exclude out of stock or recos with missing metadata.
  // [MUST CHANGE] if you have a different set of metadata fields.
  //return reco.in_stock &&
  //  reco.name &&
  //  reco.image &&
  //  reco.url &&
  //  reco.price;
  return reco.name &&
    reco.price;
}

function fetchRecos(targetId) {
  if (editorMode && extension.example_json.trim()) {
    log('Using example reco, because it is editormode');

    var recos = [];
    //for (var i = 0; i < 20; i++) {
      recos.push(JSON.parse(extension.example_json.trim()));
    //}
    recos = recos[0];
    log(recos);
    return recos;
  } else {
    log('else part of fetcher function 1');
    var fetcher = recommender.getRecommendationsFetcher(recommenderKey, targetId, {
      preFilter: preFilter,
      canonicalize: canonicalize,
      postFilter: postFilter
    });
    log('else part of fetcher function 2');
    log(fetcher);
    return fetcher.next(extension.max);
  }
}

function renderRecos(recos) {
  recos = recos.slice(0, extension.max);
  if (recos.length === 0) {
    // using example reco if there are no recos yet
    log('Using example reco from render function');
    recos.push(JSON.parse(extension.example_json.trim()));
    //log("recos is: " + recos);
    //log(recos[0]);
    recos = recos[0];
    log(recos);
  }

  var html = extension.$render({
    extension: extension,
    recos: recos,
  });

  log("the html is: " + html);

  utils.waitForElement(extension.selector).then(function(selectorElem) {
    // Inject the extension html onto the page.
    switch (extension.placement) {
      case 'before':
        selectorElem.insertAdjacentHTML('beforebegin', html);
        break;
      case 'after':
        selectorElem.insertAdjacentHTML('afterend', html);
        break;
      case 'prepend':
        selectorElem.insertBefore(html, selectorElem.firstChild);
        break;
      case 'append':
        selectorElem.appendChild(html);
        break;
      case 'replace-content':
        // This is to save the original content in a hidden div so that we can restore it in undo.js.
        var origHtml = selectorElem.innerHTML();

        selectorElem.innerHTML= '';
        selectorElem.appendChild(html).appendChild(
          '<div>'
            .setAttribute('id', 'optimizely-extension-' + extension.$instance + '-orig')
            .appendChild(origHtml)
            .style.display = 'none'
        );
        break;
      default:
        throw new Error('Unknown placement ' + extension.placement);
    }
  }).then(function() {
    // This selector should select the anchor element around each reco.
    var recosSelector = '#optimizely-extension-' + extension.$instance + ' a.reco-link';

    document.querySelectorAll(recosSelector).click(function () {
      optimizely.push({
        type: 'event',
        // Replace with the actual reco click event you've created for this project, if different.
        eventName: 'extension_recommended_item_click',
        tags: {
          // Tag the id of the clicked reco. The selector may differ depending on your HTML setup.
          // clicked_id: $(this).find('meta[itemprop="id"]').attr('content')
          // double check if this is actually the right way to do this without jQuery
          clicked_id: this.querySelectorAll('meta[itemprop="id"]').getAttribute('content')
        }
      });
    });
  });
}

if (recommender) {
  log('if recommender is true');
  // this is the replacement for the old jQuery document.ready,
  // if you use DOMContentLoaded it doesn't work in the     editor
  // [MUST CHANGE] Wait for the correct element (now extension.selector),
  // so you are 100% sure the getTargetId function will be able to get the targetId
  utils.waitForElement(extension.selector).then(function() {
      utils.Promise.resolve(getTargetId())
          .then(fetchRecos)
          .then(renderRecos);
  });
}
