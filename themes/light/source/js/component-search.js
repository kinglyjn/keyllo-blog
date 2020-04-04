
( function( window ) {

'use strict';

// class helper functions from bonzo https://github.com/ded/bonzo

function classReg( className ) {
  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
}

// classList support for class management
// altho to be fair, the api sucks because it won't accept multiple classes at once
var hasClass, addClass, removeClass;

if ( 'classList' in document.documentElement ) {
  hasClass = function( elem, c ) {
    return elem.classList.contains( c );
  };
  addClass = function( elem, c ) {
    elem.classList.add( c );
  };
  removeClass = function( elem, c ) {
    elem.classList.remove( c );
  };
}
else {
  hasClass = function( elem, c ) {
    return classReg( c ).test( elem.className );
  };
  addClass = function( elem, c ) {
    if ( !hasClass( elem, c ) ) {
      elem.className = elem.className + ' ' + c;
    }
  };
  removeClass = function( elem, c ) {
    elem.className = elem.className.replace( classReg( c ), ' ' );
  };
}

function toggleClass( elem, c ) {
  var fn = hasClass( elem, c ) ? removeClass : addClass;
  fn( elem, c );
}

var classie = {
  // full names
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass,
  // short names
  has: hasClass,
  add: addClass,
  remove: removeClass,
  toggle: toggleClass
};

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( classie );
} else {
  // browser global
  window.classie = classie;
}

})( window );




//var ModalEffects = (function() {

$(function(){


  function init() {

    var overlay = document.querySelector( '.md-overlay' );

    [].slice.call( document.querySelectorAll( '.md-trigger' ) ).forEach( function( el, i ) {

      var modal = document.querySelector( '#' + el.getAttribute( 'data-modal' ) );

      function removeModal( hasPerspective ) {
        classie.remove( modal, 'md-show' );

        if( hasPerspective ) {
          classie.remove( document.documentElement, 'md-perspective' );
        }
      }
      function removeModalHandler() {
        removeModal( classie.has( el, 'md-setperspective' ) ); 
      }


      // 显示搜索
      function toggleSearch() {
        classie.add( modal, 'md-show' );
        overlay.removeEventListener( 'click', removeModalHandler );
        overlay.addEventListener( 'click', removeModalHandler );
        if( classie.has( el, 'md-setperspective' ) ) {
          setTimeout( function() {
            classie.add( document.documentElement, 'md-perspective' );
          }, 25 );
        }

        //清除之前内容
        var searchResult = document.getElementById("local-search-result");
        searchResult.innerHTML = "";
        
        //搜索框获取焦点
        var searchInput = document.getElementById("local-search-input");
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
            searchInput.select();
        }
      }

      // 点击样式为.md-trigger的按钮，显示搜索
      el.addEventListener( 'click', function( ev ) {
        toggleSearch();
      });

      // 双击ctrl，显示搜索
      var initial = 0;
      var shouldToggle = function (time) {
        var gap = time - initial;
        initial = time;
        return gap < 500;
      };
      document.onkeyup=function(e) {
        var now = new Date().getTime();
        if (e.keyCode == 17 && shouldToggle(now)) {
          // 点击搜索按钮
          document.getElementById("my-open-search-btn").click();
        } else if (e.keyCode == 18 && shouldToggle(now)) {
          // 点击目录按钮
          var sidebar_left_link = document.getElementById("sidebar-left-link");
          if (sidebar_left_link) {
              sidebar_left_link.click();
          }
        }
      }      

      // 点击.md-close样式的按钮，关闭搜索
      close = modal.querySelector( '.md-close' );
      if (close) {
        close.addEventListener( 'click', function( ev ) {
          ev.stopPropagation();
          removeModalHandler();
        });
      }

      // 判断是否为整数
      function isInteger(obj){
        return typeof obj === 'number' && obj%1 === 0;
      }

      // 注册onkeydown事件
      document.onkeydown=function(ev) {
        var oEvent=ev||event;
       
        if(oEvent.keyCode==27) { // 点击ESC键，关闭搜索
          //ev.stopPropagation();
          //removeModalHandler();
          document.getElementById("my-close-search-btn").click();
        } else if(oEvent.keyCode==13) { // 点击enter键 & jump_to_page_input在焦点上 跳转页面
          var $pageInput = $("#jump_to_page_input");
          var jumpPageFocus = $pageInput.is(":focus");
          if (jumpPageFocus) {
            var page_num = parseInt($pageInput.val());
            var page_total = parseInt($("#jump_to_page_hidden_total").val());
            if (isInteger(page_num) ) {
              var page_site = $("#jump_to_page_hidden_site").val();
              var page_base = $("#jump_to_page_hidden_base").val();
              if (page_num===1) { // 第一页
                location.href = page_site + page_base;
              } else if (page_num>1 && page_num<=page_total) { // 中间页和最后页
                location.href = page_site + page_base + "page/" + page_num; 
              } else {
                alert("请输入正确的页码");
              }
            } 
          }
        }       

      }

    } );

  }

  init();

//})();

});



// 搜索函数
var searchFunc = function(path, search_id, content_id) {
    'use strict';
    $.ajax({
        url: path,
        dataType: "xml",
        success: function( xmlResponse ) {
            // get the contents from search data
            var datas = $( "entry", xmlResponse ).map(function() {
                return {
                    title: $( "title", this ).text(),
                    content: $("content",this).text(),
                    url: $( "url" , this).text()
                };
            }).get();
            var $input = document.getElementById(search_id);
            var $resultContent = document.getElementById(content_id);
            $input.addEventListener('input', function(){
                var str='<ul class=\"search-result-list\">';                
                var keywords = this.value.trim().toLowerCase().split(/[\s\-]+/);
                $resultContent.innerHTML = "";
                if (this.value.trim().length <= 0) {
                    return;
                }
                // perform local searching
                datas.forEach(function(data) {
                    var isMatch = true;
                    var content_index = [];
                    var data_title = data.title.trim().toLowerCase();
                    var data_content = data.content.trim().replace(/<[^>]+>/g,"").toLowerCase();
                    var data_url = data.url;
                    var index_title = -1;
                    var index_content = -1;
                    var first_occur = -1;
                    // only match artiles with not empty titles and contents
                    if(data_title != '' && data_content != '') {
                        keywords.forEach(function(keyword, i) {
                            index_title = data_title.indexOf(keyword);
                            index_content = data_content.indexOf(keyword);
                            if( index_title < 0 && index_content < 0 ){
                                isMatch = false;
                            } else {
                                if (index_content < 0) {
                                    index_content = 0;
                                }
                                if (i == 0) {
                                    first_occur = index_content;
                                }
                            }
                        });
                    }
                    // show search results
                    if (isMatch) {
                        // 注意超链接以根路径为基础
                        str += "<li><a href='/"+ data_url +"' class='search-result-title'>"+ data_title +"</a>";
                        var content = data.content.trim().replace(/<[^>]+>/g,"");
                        if (first_occur >= 0) {
                            // cut out 90 characters
                            var start = first_occur - 20;
                            var end = first_occur + 70;
                            if(start < 0){
                                start = 0;
                            }
                            if(start == 0){
                                end = 90;
                            }
                            if(end > content.length){
                                end = content.length;
                            }
                            var match_content = content.substring(start, end); 
                            // highlight all keywords
                            keywords.forEach(function(keyword){
                                var regS = new RegExp(keyword, "gi");
                                match_content = match_content.replace(regS, "<em class=\"search-keyword\">"+keyword+"</em>");
                            });
                            
                            str += "<p class=\"search-result\">" + match_content +"...</p>"
                        }
                        str += "</li>";
                    }
                });
                str += "</ul>";
                $resultContent.innerHTML = str;
            });
        }
    });
}
