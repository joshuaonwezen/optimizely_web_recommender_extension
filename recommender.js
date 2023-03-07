// Throughout this script there will be places marked as [MUST CHANGE]. Make sure you fill in the details accordingly.
// Other places have comments to inform you what kind of customizations you can potentially make there. Make sure you
// read through them.

/**
 *  Throughout this script there will be places marked as [MUST CHANGE]. Make sure you fill in the details accordingly.
 *  Other places have comments to inform you what kind of customizations you can potentially make there. Make sure you
 *  read through them.
 *  
 *  functions:
 *      - getTargetId()
 *      - preFilter()
 *      - canonicalize()
 *      - postFilter()
 *      - fetchRecos()
 *      - getVisibleCount()
 *      - parseRecommendations()
 *      - renderRecos()
 *      - swipe()
 *      - registerButtonSwipeHandler()
 *      - registerTouchSwipeHandler()
 * 
 *  events:
 *      - <config.id>_swipe_right
 *      - <config.id>_swipe_left
 *      - <config.id>_recommendations_empty
 * 
 *  recommender content: 
 *      - image_url
 *      - name
 *      - price 
 *      - product_url
 *      - short_description
 *      - sku
 */

// jQuery is not required anymore for this extension
var utils = optimizely.get('utils');
var recommender = optimizely.get('recommender');

// This boolean tells whether you are in the editor, so that you can special case if needed.
var editorMode = !!window.optimizely_p13n_inner ||
    window.location != window.parent.location &&
    window.location.search.indexOf('optimizely_editor') > -1,
    logEnabled = editorMode || window.localStorage.getItem('logRecs');

var log = function () {
    if (logEnabled) console.log.apply(console, arguments);
};

// [MUST CHANGE]
// Fill in the real ids of the different recommenders you will use
/*
var recommenderIds = {
    "co-browse": 123,
    "co-buy": 123,
    "popular": 123,
    "user-based": 123
};
*/
// NOTE: recommenderServiceId is the catalog id
var recommenderKey = {
    recommenderServiceId: parseInt(extension.catalog),
    recommenderId: parseInt(extension.primary_recommender)
};

// Replace with the actual id tag name of the recommender service.
var idTagName = 'id';


/****************************************************************************
 *                              UI Variables
 ***************************************************************************/
var isSliderNecessary = false
var hasRecommendations = false
var allRecommendations = []
var paginationPointer = 0
var paginationPages = 0

var largeScreenWidth = 992
var mediumScreenWidth = 768
var smallScreenWidth = 575

var config = {
    id: "recommendations"
}

function getTargetId() {
    // [MUST CHANGE]
    // Replace with actual code to retrieve the id of the target entity to recommend for.
    //
    // * For most-popular algorithms, this should be a fixed value of 'popular'.
    // * For user-based algorithms, this will be the optimizely visitor id which you can get through this code:
    //   optimizely.get('visitor').visitorId
    // * For item-based algorithms such as co-browse and co-buy, this will be the target item id.
    //
/*
    switch (extension.algorithm) {
        case 'popular':
            targetId = 'popular';
            break;
        case 'user-based':
            targetId = optimizely.get('visitor').visitorId;
            break;
        case 'co-browse':
        case 'co-buy':
            // [MUST CHANGE]
            // return the target item ID (product ID/SKU)
            targetId = utag_data.product_id[0];
            break;
        default:
            targetId = 'popular';
    } */

    var targetId = optimizely.get('visitor').visitorId;
    return targetId
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
            locale,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        );
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

    return reco.sku &&
        reco.short_description &&
        reco.image_url &&
        reco.name &&
        //reco.price &&
        reco.product_url;
}

//Fetches Collaborative Filtering Recos only
function fetchRecos(targetId) {
    var data = undefined
    if (!editorMode && extension.example_json.trim()) {
        //console.log('use primary_recommender');
        var fetcher = recommender.getRecommendationsFetcher(recommenderKey, targetId, {
            preFilter: preFilter,
            canonicalize: canonicalize,
            postFilter: postFilter
        });

        data = fetcher.next(extension.max_recommendations)
            .then(function (response) {
                // we need the list for the pagination
                allRecommendations = Array.from(response)

                if (allRecommendations.length > 0) {
                    hasRecommendations = true
                    //window.cip.sendOptimizelyEvent(config.id + "_found_primary")
          			return response;	            
                } else {
                    //Send opti event when no recommendations are found
                    //console.log('-----------------> primmary recommendations empty')
                  	return response;
                }
            })
    }

    return data
}

// Fetches Cobrowse Recos
function fallbackRecos(data) {
  if(data.length > 0){
      //console.log('data already available')
      return data;
  } else {
      //Overwrite recommenderKey to co-browse as fallback algorithm
      //console.log('use secondary_recommender');
      recommenderKey.recommenderId = parseInt(extension.secondary_recommender);
      var targetId = utag_data.product_id[0];

      if (!editorMode && extension.example_json.trim()) {
          var fetcher = recommender.getRecommendationsFetcher(recommenderKey, targetId, {
              preFilter: preFilter,
              canonicalize: canonicalize,
              postFilter: postFilter
          });
          data = fetcher.next(extension.max_recommendations)
              .then(function (response) {
                  // we need the list for the pagination
                  //console.log(response)
                  allRecommendations = Array.from(response)

                  if (allRecommendations.length > 0) {
                      hasRecommendations = true
                      window.cip.sendOptimizelyEvent(config.id + "_found_secondary")
                      return response;	
                  } else {
                      //Send opti event when no recommendations are found
                      window.cip.sendOptimizelyEvent(config.id + "_empty")
                      //console.log('-----------------> secondary recommendations empty')
                      return response;
                  }
              })
      }
  }
  //console.log('Amount of recommendations: ', data.length)
  return data
}

function getVisibleCount() {
    var visibleCount = extension.visible_recommendations
    var currentWidth = window.innerWidth

    switch (true) {
        case currentWidth < smallScreenWidth:
            visibleCount = 1;
            break;
        case currentWidth < mediumScreenWidth:
            visibleCount = 2;
            break;
        case currentWidth < largeScreenWidth:
            visibleCount = 3;
        default:
            break;
    }

    return visibleCount
}

function parseRecommendations(data) {
    // Fix the Ampersand data error
    data.forEach(element => {
        element.name = element.name.replace ("&amp;","&");
    });
    var parsedRecommendations = []
    var visible_recommendations = getVisibleCount()
    var max_recommendations = data.length > extension.max_recommendations ? extension.max_recommendations : data.length

    paginationPages = Math.ceil(max_recommendations / visible_recommendations)

    for (var i = 0; i < paginationPages; ++i) {
        var slide = {}
        var start = visible_recommendations * i
        var end = start + visible_recommendations

        if (end > max_recommendations) {
            end = max_recommendations
        }

        slide.slide = i
        slide.items = data.slice(start, end)

        parsedRecommendations.push(slide)
    }

    return parsedRecommendations
}

function renderRecos(parsedRecommendations, placement) {
    recos = parsedRecommendations

    if (hasRecommendations) {
        var placement = placement || extension.placement
        var html = extension.$render({
            extension: extension,
            recos: recos,
        });

        return utils.waitForElement(extension.selector).then(function (selectorElement) {
            var recosSelector = 'optimizely-extension-' + extension.$instance
            var recosElement = document.getElementById(recosSelector)

            // if element was already rendered before, remove it
            if (recosElement) {
                recosElement.remove();
            }

            // Inject the extension html onto the page.
            switch (placement) {
                case 'before':
                    selectorElement.insertAdjacentHTML('beforebegin', html);
                    break
                case 'after':
                    selectorElement.insertAdjacentHTML('afterend', html);
                    break
                case 'prepend':
                    selectorElement.insertBefore(html, selectorElement.firstChild);
                    break;
                case 'append':
                    selectorElement.appendChild(html);
                    break
                case 'replace-content':
                    // This is to save the original content in a hidden div so that we can restore it in undo.js.
                    var origHtml = selectorElement.innerHTML()

                    selectorElement.innerHTML = '';
                    selectorElement.appendChild(html).appendChild(
                        '<div>'
                            .setAttribute('id', 'optimizely-extension-' + extension.$instance + '-orig')
                            .appendChild(origHtml)
                            .style.display = 'none'
                    )
                    break
                default:
                    throw new Error('Unknown placement ' + extension.placement)
            }
        })
    }
}

function swipe(event) {
    var hasLeftClass = event.currentTarget.classList.contains("left")
    var direction = hasLeftClass ? -1 : 1
    var directionString = hasLeftClass ? "left" : "right"
    var nextPage = (paginationPointer + direction) % paginationPages

    var slider = event.currentTarget.parentElement.parentElement.firstElementChild
    var paginationText = event.currentTarget.parentElement.childNodes[3]
    var scrollValue = 0

    // 1. update pointer
    paginationPointer = nextPage >= 0 ? nextPage : (paginationPages - 1)

    // 2. scrollLeft with updated value
    scrollValue = paginationPointer * slider.offsetWidth
    slider.scrollLeft = scrollValue

    // 3. update pagination text
    paginationText.innerHTML = (paginationPointer + 1) + " / " + paginationPages

    window.cip.sendOptimizelyEvent(config.id + "_swipe_" + directionString)
}

function updatePagination() {
    if (hasRecommendations) {
        var paginationText = (paginationPointer + 1) + " / " + paginationPages

        paginationStateElement = document.getElementsByClassName('pagination-state')[0]
        paginationStateElement.innerHTML = paginationText
    }
}

function registerButtonSwipeHandler() {
    utils.waitForElement('.swiper-button').then(function () {

        var paginationWrapper = document.getElementsByClassName('pagination-wrapper')[0]
        var swipeButtons = document.getElementsByClassName('swiper-button')
        var isSliderNecessary = allRecommendations.length > 4

        if (!isSliderNecessary) {
            //paginationWrapper.style.display = "none"
            paginationWrapper.style.opacity = 0;
        }
        else {
            for (var i = 0; i < swipeButtons.length; ++i) {
                swipeButtons[i].addEventListener("click", swipe)
            }
        }
    })
}

function registerTouchSwipeHandler() {
    var slidesElement = document.getElementsByClassName("slides")[0]
    var startX = 0
    var endX = 0
    var movementDelta = 0

    if (hasRecommendations) {
        slidesElement.addEventListener("touchstart", function (event) {
            startX = event.changedTouches[0].pageX
        })

        slidesElement.addEventListener("touchend", function (event) {
            endX = event.changedTouches[0].pageX
            movementDelta = endX - startX

            if (Math.abs(movementDelta) >= 10) {
                var currentItem = Math.ceil(slidesElement.scrollLeft / slidesElement.offsetWidth)
                var direction = movementDelta > 0 ? -1 : 1

                if (direction < 0) {
                    currentItem = Math.floor(slidesElement.scrollLeft / slidesElement.offsetWidth)
                }

                paginationPointer = currentItem
                updatePagination()
            }
        })
    }
}

function registerScreenHandler() {
    if (hasRecommendations) {
        window.addEventListener("resize", function (event) {
            var currentItemCount = recos !== undefined ? recos[0].items.length : 4
            var newItemCount = getVisibleCount()

            if (newItemCount !== currentItemCount) {
                paginationPointer = 0

                utils.Promise.resolve(parseRecommendations(allRecommendations))
                    .then(renderRecos)
                    .then(updatePagination)
                    .then(registerButtonSwipeHandler)
                    .then(registerTouchSwipeHandler)
            }
        })
    }
}

if (recommender) {
    // this is the replacement for the old jQuery document.ready,
    // if you use DOMContentLoaded it doesn't work in the editor
    // [MUST CHANGE] Wait for the correct element (now extension.selector),
    // so you are 100% sure the getTargetId function will be able to get the targetId
    utils.waitForElement(extension.selector).then(function () {
        utils.Promise.resolve(getTargetId())
            .then(fetchRecos)
      		.then(fallbackRecos)
            .then(parseRecommendations)
            .then(renderRecos)
            .then(updatePagination)
            .then(registerButtonSwipeHandler)
            .then(registerTouchSwipeHandler)
            .then(registerScreenHandler)
    })

} else {
    console.warn('-----------------> recommender not present')
}