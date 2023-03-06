const colorPicker = document.getElementById('color_picker'), 
    brushWidth = document.getElementById('brushWidth'),
    colorOptions = Array.from(document.getElementsByClassName('color-option')),
    eraser = document.getElementById('eraser'),
    eraserWidth = document.getElementById('eraserWidth'),
    eraseAll = document.getElementById('eraseAll'),
    files = document.getElementById('files');

const DRAWING_MODE = true;
const SELECTION_MODE = false;
    
const canvas = new fabric.Canvas('canvas', {
    isDrawingMode: true,
    freeDrawingBrush: new fabric.PencilBrush(),
    renderOnAddRemove: true,
    fireRightClick : true,
});


fabric.util.addListener(document.getElementsByClassName('upper-canvas')[0], 'contextmenu', function(e){
    e.preventDefault();
});


// fabric.Canvas.prototype.objectCaching = false;
let isEraserMode = false;
canvas.freeDrawingBrush.width = 3;


//현재 팔레트 색 목록을 가져온다
let queue = [];
colorOptions.forEach(i => queue.push(i.dataset.color));

//undo & redo
//위치 반영이 안되는구나..
// canvas.on('object:added',function(){
//     //redo 할 때 object:add 이벤트 감지함
//     //undo, redo 할 때는 h 배열이 남아있고
//     //새롭게 그림이 추가 될 때 h 배열이 초기화 되어서 redo는 더이상 불가
//     //redo할 때 h배열이 초기화되지 않도록 하는 코드가 아래 코드
//     if(!isRedoing){
//         history = [];
//     }
//     isRedoing = false;
// });

// function onUndo(){
//     if(canvas._objects.length>0){
//         history.push(canvas._objects.pop());
//     canvas.renderAll();
//     }
// }
// function onRedo(){
//     if(history.length > 0){
//         isRedoing = true;
//     canvas.add(history.pop());
//     }
// }

//1. 객체가 수정될 때마다 현재 상태를 currentState에 저장, 이전 상태를 history
//   undo에 저장한다
//   1-1 이 stack에 들어가는 데이터의 크기를 최소한으로 하는 것이 관건
//   1-2 이 stack의 크기는 30으로 제한
//2. undo 클릭시, undostack의 최상단 데이터를 history에 넣고 renderAll()함
//3. redo 클릭시, 현재 상태를 historyUndo에 넣고, redo 최상단 데이터를
//   꺼내 rederAll한 후, currentState로 지정
//   historyProcessing과 isRedoing은 어떻게?
// let isRedoing = false;
const HISTORY_UNDO_LIMIT = 50;


fabric.Canvas.prototype._historyInit = function(){
    //this = canvas
    this.historyUndo = [];
    this.historyRedo = [];
    this.extraProps = ['selectable', 'editable'];
    this.currentHistoryUndoLength = 0;

    this.currentState = this._getCurrentState();
    let subCanvasClass = new SubCanvasClass();
    this.on({
        'object:added' : this.saveHistory,
        'object:removed' : this.saveHistory,
        'object:modified' : this.saveHistory,
        'object:skewing' : this.saveHistory,
        'before:selection:cleared' : this.checkIText,
        'mouse:down' : subCanvasClass._onMouseDown,
        'mouse:down:before' : subCanvasClass._onMouseDownBefore,
        'selection:created' : subCanvasClass._onSelectionCreate,
    })
}

//https://github.com/mazong1123/fabric.ext/blob/master/fabricext/scripts/fabric.canvasex.js#L63
function onDblClickHandler(e){
    console.log('double click');
}

let rMenuEl = document.getElementById('rMenu');
if(rMenuEl.addEventListener){ //rMenuEl에 listener이 아무것도 없으면 등록
    rMenuEl.addEventListener('contextmenu', function(e){
        e.preventDefault();
    }, false); //요 false는 뭐지?
}
//1. 객체를 선택한다
//2. 선택된 객체를 오른 클릭 한다
//3. 삭제 버튼이 뜬다
//4. 삭제 버튼을 클릭하면 객체가 삭제된다
let SubCanvasClass = fabric.util.createClass(fabric.Canvas, {
//클릭시 이벤트 감지 순서 selection -> mouse down

    //선택을 감지하는 메서드
    //static 클래스
    _onSelectionCreate : function(e, target){
        let obj;
        if(target){
            obj = target;
        } else {
            obj = this.getActiveObject();
        }
        obj.set('isSelected', true);
        canvas.historyProcessing = true;
    },

    _onMouseDown : function(options){
        this.callSuper('_onMouseDown', options); //왜쓸까?

        try{
            if(!options.target||canvas.historyProcessing){ //drawing or right after selection
                //this != canvas  //canvas가 더 상위개념인듯?
                canvas.historyProcessing = false;
                return;
            } else if(options.target.isSelected===true){
                if(options.button !== 3) {
                    return;
                }
                let rMenuEl = document.getElementById('rMenu');
                rMenuEl.className = "show";
                rMenuEl.style.top = mouseY(options.e) + 'px';
                rMenuEl.style.left = mouseX(options.e) + 'px';
                
                return;
            }
                
        } catch(error){
            console.log('현재 삭제 기능이 동작하지 않습니다. 다시 시도해주시길 바랍니다.');
            console.log(error);
        }

        
    },

    _onMouseDownBefore : function(options){
        // 클릭한 객체 : ' + options.target
        // activated된 객체 : ' + this.getActiveObject()

        let clickedObj = options.target;
        let activatedEl = this.getActiveObject();
        if(!clickedObj||!activatedEl){
            this.historyProcessing = true;
            return;
        } else if(activatedEl.path !== clickedObj.path){
            //options.e.button
            //0 : left
            //1 : middle
            //2 : right
            if(options.e.button!==0){
                canvas.historyProcessing = true;
                return;
            }

            activatedEl.isSelected = false;
            let scc = new SubCanvasClass();
            scc._onSelectionCreate('', clickedObj);
        }
    },

    onRemoveObj : function(options){
        let scc = new SubCanvasClass();
        scc._asyncHideRmenuBtn();
        console.log('async 메서드는 호출됨');
        let activeObj = canvas.getActiveObject();
        if(activeObj) {
            canvas.remove(activeObj);
        }
        console.log('객체 삭제됨')
    },

    _asyncHideRmenuBtn : async function(option){
        setTimeout(() =>{
            document.getElementById('rMenu').className = 'hide';
        }, 80);
    }


});

window.onclick = function(e){
    if(!e.target.matches('.removeObjBtn')){
        document.getElementById('rMenu').className = 'hide';
    }
}

function mouseX(e) {
    if (e.pageX) {
        return e.pageX;
    } else if (e.clientX) {
        return e.clientX + (document.documentElement.scrollLeft ?
        document.documentElement.scrollLeft :
        document.body.scrollLeft);
    } else {
        return null;
    }
}

function mouseY(e) {
    if (e.pageY) {
        return e.pageY;
    } else if (e.clientY) {
        return e.clientY + (document.documentElement.scrollTop ?
        document.documentElement.scrollTop :
        document.body.scrollTop);
    } else {
        return null;
    }
}

//꼭 canvas에 함수를 선언해야할까?
//text 박스에 아무것도 안 적을 경우, text박스 삭제
fabric.Canvas.prototype.checkIText = function(e){
// - selection cleard  되기 전
// - text가 없는지 확인
// - 없으면 itext 객체 삭제
// - undo stack에 이전상태 저장 x
// - 있으면 render

//선택을 해제할 때(선택후 우클릭, 객체 삭제를 위한 멤버)
// let activeObject = this.getActiveObject();
this.getActiveObject().set('isSelected', false);

// IText 일 떄만 함수가 호출 되게.
    if(canvas.getActiveObject().get('type')!=='i-text'){
        return;
    }

    if(this.isCheckingText){
        return;
    }

    this.isCheckingText = true;
    this.historyProcessing  = true;

    let text = e.target.text.split(' ').join('');

    const exceptLineBreakRegex = /[^\n]/;
    if(text===''||!exceptLineBreakRegex.test(text)){
        this.remove(this.getActiveObject());
    }

    this.isCheckingText = false;
    this.historyProcessing  = false;
}

fabric.Canvas.prototype.getTextBox = function(){
    this.changeDrawingMode(SELECTION_MODE);
    this.historyProcessing = true;

    let newTextbox = new fabric.IText('');
    newTextbox.set({
        padding: 5,       
    });
    
    canvas.centerObject(newTextbox);
    canvas.add(newTextbox).setActiveObject(newTextbox);
    newTextbox.enterEditing();
    canvas.renderAll();

    this.historyProcessing = false;
}

fabric.Canvas.prototype._getCurrentState = function(){
    // return JSON.stringify(this.toDatalessJSON(this.extrProps));
    return JSON.stringify(canvas);
}

fabric.Canvas.prototype.saveHistory = function(options){ //현재 상태 저장
    // console.log('save')
    //saveHistory() 호출하는 경우
    //1. _loadHistory()에서 JSON관련 메서드를 호출할 떄 remove 이벤트 감시지
    //   (historyProcessing = true 일 때)
    //2. canvas에 새로운 객체를 추가할 때

    //새로 그린 후이고, stack에 데이터를 저장 중이 아닐 때
    if(!this.isRedoing && !this.historyProcessing){
        this.historyRedo = []; //redo 비우기
    }

    this.isRedoing = false;

    // this.historyProcessing
    //_loadHistory()에서 JSON관련 메서드를 호출할 떄 remove 이벤트 감지 시
    //중복해서 현재 canvas 상태를 undo stack에 저장하지 않기 위함
    if (this.historyProcessing){
        return;
    }
    // this.historyUndo.push(this.currentState);
    this.pushHistoryUndo(this.currentState);
    this.currentState = this._getCurrentState();
}

fabric.Canvas.prototype.pushHistoryUndo = function(history){
    if(this.currentHistoryUndoLength < HISTORY_UNDO_LIMIT){
        this.historyUndo.push(history);
        this.currentHistoryUndoLength++
        return;
    }

    this.historyUndo.shift();
    this.historyUndo.push(history);
    // this.currentHistoryUndoLength++
}


fabric.Canvas.prototype.undo = function(callback){
    this.historyProcessing  = true;
    //undo.addEventListener('click', canvas.undo);
    //로 undo호출시 this는 input#undo
    //html의 script에서 canvas.undo()호출시 this = canvas가
    const history = this.historyUndo.pop();
    if(history){
        this.historyRedo.push(this.currentState);
        this.currentHistoryUndoLength--
        this._loadHistory(history);
        this.currentState = history;
    } else {
        this.historyProcessing = false;
    }
}

fabric.Canvas.prototype.redo = function(){
    this.historyProcessing  = true;
    this.isRedoing = true;
    const history = this.historyRedo.pop();

    if(history){
        // this.historyUndo.push(this.currentState);
        this.pushHistoryUndo(this.currentState);
        this._loadHistory(history);
        // this.currentState = this._getCurrentState();
        // 이미지는 브러쉬와 다른 때에 렌더링이 되서 
        //이 시점에서 currentState()를 구하면, 이전 상태를 받게된다.
        this.currentState = history;
    }
}

fabric.Canvas.prototype._loadHistory = function(history){
    let that = this;
    // loadFromJSON 함수가 내부적으로 JSON 마칠 때, renderALL 함수를 호출
    this.loadFromJSON(history, function(){ 
        // that.renderAll();
        that.historyProcessing = false;
    });
    
}


function changeColorHistory(currentColor){
    if(queue.includes(currentColor)){
        return;
    }

    queue.pop();
    queue.unshift(currentColor);

    // let colorEl = document.getElementsByClassName('color-option');
    Array.prototype.forEach.call(colorOptions, (el, i) => {
        el.style.background = el.dataset.color = queue[i]});
}

function onColorPicking(evt){
    canvas.changeDrawingMode(DRAWING_MODE);
    isEraserMode = false;
    canvas.freeDrawingBrush.color = evt.target.value;
    setFreeDrawingBrushWidth(brushWidth.value);
    changeColorHistory(evt.target.value);
}

function onClickColorOption(evt){
    canvas.changeDrawingMode(DRAWING_MODE);
    isEraserMode = false;
    canvas.freeDrawingBrush.color = evt.target.dataset.color;
    //brush width init
    setFreeDrawingBrushWidth(brushWidth.value);
    changeColorHistory(evt.target.dataset.color);
}

function setFreeDrawingBrushWidth(width) {
    canvas.freeDrawingBrush.width = parseInt(width,10);
}

function onBrushWidthChange(evt){
    if(!isEraserMode){
        setFreeDrawingBrushWidth(evt.target.value);
    }
}

function onClickEraser(evt){
    canvas.changeDrawingMode(DRAWING_MODE);
    isEraserMode = true;
    canvas.freeDrawingBrush.color = '#ffffff';
    //eraser width init
    setFreeDrawingBrushWidth(eraserWidth.value);
}

function onEraserWidthChange(evt){
    if(isEraserMode){
        setFreeDrawingBrushWidth(evt.target.value);
    }
}

function onEraseAll(evt){
    canvas.changeDrawingMode(DRAWING_MODE);
    // canvas.clear();
    let rect = new fabric.Rect({
        left:0,
        top:0,
        fill:'white',
        width: canvas.width,
        height: canvas.height
    });
    
    canvas.add(rect);
}

document.getElementById('imgLoader').onchange = function handleImage(e) {
    // fabric.Canvas.prototype.changeDrawingMode(false);
    canvas.changeDrawingMode(SELECTION_MODE);
    let reader = new FileReader();
    
    reader.onload = function (event){
        let imgObj = new Image();
        imgObj.src = event.target.result;

        imgObj.onload = function () {
            let image = new fabric.Image(imgObj);
            image.scaleToWidth(150);

            canvas.centerObject(image);
            canvas.add(image);
            canvas.renderAll();
            // canvas.setActiveObject(image);
            // canvas.toDataURL({format : 'png', quality:0.8});
        }
    }

    reader.readAsDataURL(e.target.files[0]);
}

fabric.Canvas.prototype.changeDrawingMode = function(mode){
    canvas.isDrawingMode = mode;
}

colorPicker.addEventListener('change', onColorPicking);
brushWidth.addEventListener('change', onBrushWidthChange);
colorOptions.forEach(i => i.addEventListener('click', onClickColorOption));
eraser.addEventListener('click', onClickEraser);
eraserWidth.addEventListener('change', onEraserWidthChange);
eraseAll.addEventListener('click', onEraseAll);
// undo.addEventListener('click', canvas.undo);
// redo.addEventListener('click', canvas.redo);