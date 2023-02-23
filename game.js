//This REALLY should have had everything split away into classes - e.g., board, game state, player (computer + person playing), etc
//Would have gone a LONG way to clean up the code 
//A lot of the functions in here do > 1 thing as well which makes things difficult to track

//BAD!!!!!!!!!!!!! Difficult to track 
firstClick = '';
startPosition = '';
endPosition = '';
oldFirstClick = '';
board = [];
numberOfMovesPlayed = 0;
color = '';
endSquareNum = '';
computerTurn = true;
gameOver = false;
usedHint = false;
gameDraw = false;
gameLost = false;
gameScoreTest = 1; //0 = loss, 0.5 = draw, 1 = win

//Maybe call this something a little more descriptive
main();


//Why is this async
async function resetGame() { 
	firstClick = '';
	startPosition = '';
	endPosition = '';
	oldFirstClick = '';
	numberOfMovesPlayed = 0;
	color = '';
	endSquareNum = '';
	computerTurn = true;
	gameOver = false;
	gameLost = false;
	gameDraw = false;
	gameScoreTest = 1;
}
//Needlessly async
async function rightClickReset(e) { 
	if(e.button == 2) { 
		firstClick = '';
		oldFirstClick = '';
		await removeColorSquares(); 
	}
}

//Rather than iterating through EVERY square to do this, why not pass it the actual square since I know what the hint is going to be...
//OR map squares in the FEN string (e.g., g2) to square number since I know squares is 64 squares long - makes this MUCH faster
//Also needlessly async
//Also I am not even adding an event listener here so the function name misrepresents what's going on here
async function hintEventListener() { 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		if(squares[i].classList[1] == startPosition) { 
			squares[i].classList.add('hint');
		}
	}
	gameScoreTest = 0;
}
//This could for sure be done better 
	// Could chunk our results based on ratings and put them into a dictionary/hash map of some kind - requires manual effort, also what if we were to extend our puzzle section... Not really viable
	// Even doing this ONCE and then using that to inform our next decision to select the next puzzle would be an improvement <-- This makes sense
	// Or a binary search to rapidly locate or get close to our puzzle rating <-- This in combination with the one above could be best
	// Also why is it async...
	// Could do a one time sweep on first loading and essentially load the ELO ratings of the puzzles rounded to the nearest 10 for example - i.e., map[100] represents all puzzles between 906 to 1005.
		//Given the large puzzle selection we have - we have a large list of puzzles
		//This of course requires us to use memory to store the map
	//Again, could do a combination of all above (excluding number 1) 
		//I.e.: First time load - binary search to get to puzzles with our rating. We now know the puzzles we can use (since we have a range of +/- 100)
		//With this, load, say, +/- 300 ELO puzzles into a hash map for rapid access like I had mentioned before
async function getPuzzleNum(data) { 
	ratingLower = parseInt(localStorage.getItem('playerRating')) - 100;
	ratingUpper = parseInt(localStorage.getItem('playerRating')) + 100;
	min = 0;
	max = 5000;
	numFound = false;
	while(numFound == false) { 
		randomNum = Math.floor(Math.random() * (max - min) + min);
		randomRating = data[randomNum].Rating;
		if((randomRating >= ratingLower) && (randomRating <= ratingUpper)) { 
			numFound = true;
		}
		console.log("num found = false")
	}
	return randomNum;
}

async function main() { 
	try { 
		gameState = { 
			computerTurn: true,
			eventsLoaded: false,
		};

		//Create glicko settings obj
		var settings = { 
			tau: 0.5,
			rating: 500,
			rd: 100,
			vol: 0.06
		};
		var ranking = new glicko2.Glicko2(settings);
		//Create 'human' player
		//localStorage.setItem('playerRating', 500);
		var human = await ranking.makePlayer(parseInt(localStorage.getItem('playerRating')), 50, 0.06);
		var matches = [];
		//Look! I found addHintListener...
		hintBtn = document.querySelector('.hint-button');
		hintBtn.addEventListener('click', hintEventListener);
		//I think renaming this to something a little more descriptive would help, especially with my confusing use of globals, it would be confusing to know which board is what
		//We have board[] up at the top, and now wholeBoard. maybe DOMBoard or something like this would make it much more clear what it actually is
		wholeBoard = document.querySelector('.board');
		wholeBoard.addEventListener('mouseup', rightClickReset);

		while(true) {
			await resetGame();
			const data = await toJson('./UpdatedLichessPuzzles.csv');
			puzzleNum = await getPuzzleNum(data);
			board = await FENStringInterpreter(data[puzzleNum].Fen);
			maxMoves = await getNumberOfMoves(data[puzzleNum].Moves);
			gameOver = false

			localStorage.setItem('playerRating', human.getRating())
			scoreBoard = document.querySelector('.score');
			scoreBoard.innerHTML = parseInt(human.getRating())

			//Create a new 'bot' player with the puzzle rating so we can update the ELO based on the result
			var bot = await ranking.makePlayer(data[puzzleNum].Rating, data[puzzleNum].RatingDeviation, 0.06);

			while(gameOver == false) { 
				await sleep(1);
				if(computerTurn == true) { 
					//This essentially prevents the user from clicking on anything whilst the computer 'thinks' and moves, as well as removes the indicators on the screen that may have 
					//Confused them into thinking it was their turn, for whatever reason.
					await removeColorSquares();
					await removeComputerColorSquares();
					await removeEventListeners();
					await playComputerMove(data[puzzleNum].Moves, gameState);
					gameState.eventsLoaded = false; 
				}
				if (gameState.eventsLoaded == false) { 
					firstClick = '';
					oldFirstClick = '';
					await addEventListeners(data[puzzleNum].Moves, gameState);
				}
				if(numberOfMovesPlayed >= maxMoves) { 
					await removeAllImgDiv();
					await removeEventListeners();
					gameOver = true;
					puzzleNum++;
					matches.push([human, bot, gameScoreTest]);
					ranking.updateRatings(matches);
				}
			}
		}
	} catch (err) { 
		console.error('Error', err);
	}
}

//Why async?
//Also why not explicitly track what ARE squares with event listeners as we do it the first time
//Saving us needlessly scanning through 64 squares every single time
async function removeEventListeners() { 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		if(i == endSquareNum) { 
			squares[i].removeEventListener('click', clickedOnEndPosition);
		} else { 
			squares[i].removeEventListener('click', clickedNonEndPosition);
		}
	}
}

//Why async
//Also, similarly to how I mentioned before - I could have used a map that uses the move (e.g., g2) as a key with the square number it maps to - constant time access!
async function addEventListeners(moveset, gameState) { 
	var regex = new RegExp(' ', 'g');
	updateMoveset = await moveset.replace(regex, '');
	startPosition = await updateMoveset.slice(4*numberOfMovesPlayed, 4*numberOfMovesPlayed+2);
	endPosition = await updateMoveset.slice(4*numberOfMovesPlayed+2, 4*numberOfMovesPlayed+4);
	squares = document.querySelectorAll('.square');

	for(i = 0; i < squares.length; i++) { 
		if(squares[i].classList[1] == endPosition) { 
			endSquareNum = i;
			squares[i].addEventListener('click', clickedOnEndPosition);
		} else { 
			squares[i].addEventListener('click', clickedNonEndPosition);
		}
	}
	gameState.eventsLoaded = true;
}
//Function name doesn't actually really describe at all what this does, nor is it particularly easy to read and understand what it does
//Again, if I could just map a square coordinate to an index in squares, I could save needlessly iterating through all 64 squares just to locate ONE square

//All this function really does is light up the square green when you click on it (if it has a piece on it), and for some reason also updates whether you drew or loss
//if you clicked on the wrong square
async function clickedNonEndPosition() { 
	oldFirstClick = firstClick;
	squares = document.querySelectorAll('.square');
	firstClick = event.target.parentNode.classList[1];
	if(firstClick == undefined) { 
		firstClick = event.target.classList[1];
	}
	for(i = 0; i < squares.length; i++) { 
		if((squares[i].classList[1] == firstClick) && squares[i].hasChildNodes()) { 
			squares[i].classList.add('green-class');
		}
	}
	if(firstClick != startPosition && oldFirstClick != endPosition) { 
		if(oldFirstClick != '') { 
			if(firstClick != oldFirstClick) {
				if(numberOfMovesPlayed > 1) { 
					gameScoreTest = 0.5;
				} else { 
					gameScoreTest = 0;
				}
			}
		}
	}
}

//What this does is update the board by removing the piece 'i.e., if a knight moves to a square that once had a piece on it, we need to remove the piece that was 
//once on that square and replace it with the knight that now belongs on that square
//Additionally, we update it to remove the hint event listener - this lights the square green to indicate that is what the next move in the sequence was
async function clickedOnEndPosition() { 
	if(firstClick == startPosition) { 
		squares = document.querySelectorAll('.square');
		for(i = 0; i < squares.length; i++) { 
			if(squares[i].classList[1] == startPosition) { 
				firstPositionPiece = board[i];
				if(squares[i].hasChildNodes()) { 
					squares[i].removeChild(squares[i].childNodes[0])
					board[i] = 0;
				}
				if(squares[i].classList.contains('hint')) { 
					squares[i].classList.remove('hint');
				}
			}
		}
		for(i = 0; i < squares.length; i++) { 
			if(squares[i].classList[1] == endPosition) { 
				squares[i].classList.add('light-green-class');
				if(squares[i].hasChildNodes()) { 
					squares[i].removeChild(squares[i].childNodes[0]);
					board[i] = firstPositionPiece;
				} else { 
					board[i] = firstPositionPiece;
				}
			}
		}
		drawPieces();
		computerTurn = true;
		numberOfMovesPlayed++;
	}
}
//Why not track what squares are green/light-green and pass to the function, instead of going through ALL squares. 
//For reference, there's only going to be 4 colored squares max on the screen at any time.
async function removeColorSquares(){ 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		if(squares[i].classList.contains('green-class')) { 
			squares[i].classList.remove('green-class');
		}
		if(squares[i].classList.contains('light-green-class')) { 
			squares[i].classList.remove('light-green-class');
		}
	}
}

//Just removes green square for computer move - when the computer makes a move initially, or in response (if the puzzle completion is a chain of moves), the 
//squares are highlighted to make it clear what was played. We already know the exact square is green since we have the coordinate from the FEN string...
//So once again, having a way to map coordinates to a square number would drastically speed this up every single time the computer plays a move
async function removeComputerColorSquares() { 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		squares[i].classList.remove('green-computer-move');
	}
}

//These are the coordinates i'm talking about - we know the start and end position... Why not use these in the removeComputerColorSquares() func
async function playComputerMove(moveset) { 
	await sleep(150);
	squares = document.querySelectorAll('.square');
	var regex = new RegExp(' ', 'g');
	updateMoveset = await moveset.replace(regex, '');
	startPosition = await updateMoveset.slice(4*numberOfMovesPlayed, 4*numberOfMovesPlayed+2);
	endPosition = await updateMoveset.slice(4*numberOfMovesPlayed+2, 4*numberOfMovesPlayed+4);
	for(i = 0; i < squares.length; i++) { 
		if(squares[i].classList[1] == startPosition) { 
			startPositionPiece = board[i];
			squares[i].classList.add('green-computer-move');
			if(squares[i].hasChildNodes()) { 
				squares[i].removeChild(squares[i].childNodes[0]);
				board[i] = 0;
			}
		}
	}

	for(i = 0; i < squares.length; i++) { 
		if(squares[i].classList[1] == endPosition) { 
			squares[i].classList.add('green-computer-move');
			if(squares[i].hasChildNodes()) { 
				squares[i].removeChild(squares[i].childNodes[0]);
				board[i] = startPositionPiece;
			} else { 
				board[i] = startPositionPiece;
			}
		}
	}
	await drawPieces();
	computerTurn = false;
	numberOfMovesPlayed++;
}


//Why async?
//Also - this starts off as a fen string interpreter but then goes on to change the main screens color depending on who's turn it is (due to white/blacks perspective, 
//the appearance of the squares are offset) - This should be separated off completely.

//What this function does is interprets the FEN string and places the pieces on board[]
//It then goes through board to draw the squares on the board via the DOM - why not just cut out the middleman?
async function FENStringInterpreter(FENString) { 
	var regex = new RegExp('/', 'g');
	updateFen = FENString.replace(regex, '');
	for(i = 0; i < 64; i++) { 
		board[i] = 0;
	}

	chessSquare = document.querySelectorAll('.square');
	mainScreen = document.querySelector('.board')

	squareCount = 0;
	letterWeAreAt = 0;
	while(squareCount < 64) { 
		currentChar = updateFen.charAt(letterWeAreAt);
		lowerCaseCurrentChar = currentChar.toLowerCase();
		if(lowerCaseCurrentChar == 'r') { 
			board[squareCount] = currentChar;
		}
		else if(lowerCaseCurrentChar == 'n') { 
			board[squareCount] = currentChar;
		}
		else if(lowerCaseCurrentChar == 'b') { 
			board[squareCount] = currentChar;
		}
		else if(lowerCaseCurrentChar == 'q') { 
			board[squareCount] = currentChar;
		}
		else if(lowerCaseCurrentChar == 'k') { 
			board[squareCount] = currentChar;
		}
		else if(lowerCaseCurrentChar == 'p') { 
			board[squareCount] = currentChar;
		}
		else { 
			squareCount = squareCount + parseInt(currentChar) - 1;
		}
		squareCount++;
		letterWeAreAt++;
	}
	color = updateFen.charAt(letterWeAreAt + 1);
	await colorBoard();
	await drawPieces(board);
	if(color == 'w') { 
		mainScreen.style.transform = 'rotate(180deg) scaleX(-1)';
		update_turn_message("Black")
		imgDivs = document.querySelectorAll('img');
		for(i = 0; i < chessSquare.length; i++) { 
			chessSquare[i].style.transform = 'rotate(180deg) scaleX(-1)';
		}
	} else if(color == 'b') { 
		mainScreen.style.transform = '';
		update_turn_message("White")
		imgDivs = document.querySelectorAll('img');
		for(i = 0; i < chessSquare.length; i++) { 
			chessSquare[i].style.transform = '';
		}
	}
	return board;
}


function update_turn_message(color) {
	let turnMessage = document.querySelector('.turn-msg');
	turnMessage.textContent = color + " to move"
}
//Finally, something that is actually meant to be async...
async function toJson(filePath) { 
	return new Promise((resolve, reject) => { 
		Papa.parse(filePath, { 
			header: true,
			download: true,
			delimiter: ',',
			newline: '\n',
			complete(results, file) { 
				resolve(results.data);
			},
			error(err, file) { 
				reject(err);
			}
		});
	});
}

async function refreshBoard() { 
	for(i = 0; i < 64; i++) { 
		board[i] = 0;
	}
}
//Could have just done this via html + CSS ...
//I also think this would just be a lot neater with 2 for loops
//Something like:
/*
	for (i = 0; x < CHESS_BOARD_LENGTH; i++) {
		for (j = 0; j < CHESS_BOARD_LENGTH; j++)
			if (color == 'b') {
				chessSquare[i].style.background = ((x + y) % 2 == 0) ? 'rgb(181, 136, 99)' : 'rgb(240, 217, 181)'
			} else {
				chessSquare[i].style.background = ((x + y) % 2 == 0) ? 'rgb(240, 217, 181) : 'rgb(181, 136, 99)
			}

	}


*/
//Could even add another ternary operator to this although I think it makes the code a little less easy to glance at and understand - something like:
/*
	for (i = 0; i < CHESS_BOARD_LENGTH; i++) {
		for (j = 0; j < CHESS_BOARD_LENGTH; j++) { 
			chessSquare[i].style.background = ((x + y) % 2 == 0) ? (color == 'b' ? DARK_TAN_RGB : LIGHT TAN RGB): (color == 'b' ? LIGHT_TAN_RGB : DARK_TAN_RGB)
		}
	}
*/

async function colorBoard() { 
	chessSquare = document.querySelectorAll('.square');
	rowCount = 0;
	if(color == 'b') { 
		for(i = 0; i < chessSquare.length; i++) { 
			if(i % 8 == 0) { 
				rowCount++;
			}
			if(i % 2 == 0) { 
				if(rowCount % 2 == 0) { 
					chessSquare[i].style.background = 'rgb(181,136,99)';
				}
				else { 
					chessSquare[i].style.background = 'rgb(240,217,181)';
				}
			}
			else { 
				if(rowCount % 2 == 0){  
					chessSquare[i].style.background = 'rgb(240,217,181)';
				}
				else { 
					chessSquare[i].style.background = 'rgb(181,136,99)';
				}
			}
		}
	}
	else { 
		for(i = 0; i < chessSquare.length; i++) { 
			if(i % 8 == 0) { 
				rowCount++;
			}
			if(i % 2 == 0) { 
				if(rowCount % 2 == 0) { 
					chessSquare[i].style.background = 'rgb(240,217,181)';
				}
				else { 
					chessSquare[i].style.background = 'rgb(181,136,99)';
				}
			}
			else { 
				if(rowCount % 2 == 0){  
					chessSquare[i].style.background = 'rgb(181,136,99)'
				}
				else { 
					chessSquare[i].style.background = 'rgb(240,217,181)';
				}
			}
		}
		
	}
}

async function drawPieces() { 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		if(board[i] != 0){ 
			piece = await generatePiece(i);
			if(piece != undefined && (!(squares[i].hasChildNodes()))) { 
				squares[i].appendChild(piece);
			}
		}
	}
}
//Again, could use a map for black pieces, and a map for white pieces
//Check if upper: Map piece to its img and generate, repeat for lower
/*Something like: the code below turns the original 94 lines down to just 21 lines of code - and I'd argue it's much easier to glance at and see what it's doing


function generatePiece(i) {
	const pieceImagePaths = {
		'p': './PieceImages/BlackPawn.png',
		'n': './PieceImages/BlackKnight.png',
		'b': './PieceImages/BlackBishop.png',
		'r': './PieceImages/BlackRook.png',
		'q': './PieceImages/BlackQueen.png',
		'k': './PieceImages/BlackKing.png',
		'P': './PieceImages/WhitePawn.png',
		'N': './PieceImages/WhiteKnight.png',
		'B': './PieceImages/WhiteBishop.png',
		'R': './PieceImages/WhiteRook.png',
		'Q': './PieceImages/WhiteQueen.png',
		'K': './PieceImages/WhiteKing.png'
	};
	const piece = board[i];
	const img = new Image(0,0);
	img.src = pieceImagePaths[piece];
	return img;
  }
}

*/
function generatePiece(i) { 
	piece = board[i];
	pieceToLower = piece.toLowerCase();
	if(pieceToLower == 'p') { 
		return pawn = generatePawnImg(piece);
	}
	else if(pieceToLower == 'n') { 
		return knight = generateKnightImg(piece);
	}
	else if(pieceToLower == 'b') { 
		return bishop = generateBishopImg(piece);
	}
	else if(pieceToLower == 'k') { 
		return king = generateKingImg(piece);
	}
	else if(pieceToLower == 'q') { 
		return queen = generateQueenImg(piece);
	}
	else if(pieceToLower == 'r') { 
		return rook = generateRookImg(piece);
	}
	else { 
		return;
	}
}
//Also for all these functions I think in hindsight (if I were to ignore my above solution)
//I should check for if upper since it makes it a little more clear what the check is for
	//Without knowing, what would you think the check is doing?
	//In reality, it's checking if it's an upper case - in chess notation, upper case P, for example, indicates a White Pawn, and a lower case p for black pawn

function generatePawnImg(currentChar) { 
	pawn = new Image(0, 0);
	if(currentChar == 'P') { 
		pawn.src = './PieceImages/WhitePawn.png';
	}
	else { 
		pawn.src = './PieceImages/BlackPawn.png';
	}
	return pawn;
}

function generateKnightImg(currentChar) { 
	knight = new Image(0, 0);
	if(currentChar == 'N') { 
		knight.src = './PieceImages/WhiteKnight.png';
	}
	else { 
		knight.src = './PieceImages/BlackKnight.png';
	}
	return knight;
}

function generateBishopImg(currentChar) { 
	bishop = new Image(0, 0);
	if(currentChar == 'B') { 
		bishop.src = './PieceImages/WhiteBishop.png';
	} 
	else { 
		bishop.src = './PieceImages/BlackBishop.png';
	}
	return bishop;
}

function generateKingImg(currentChar) { 
	king = new Image(0, 0);
	if(currentChar == 'K') { 
		king.src = './PieceImages/WhiteKing.png';
	}
	else { 
		king.src = './PieceImages/BlackKing.png';
	}
	return king;
}

function generateQueenImg(currentChar) { 
	queen = new Image(0, 0);
	if(currentChar == 'Q') { 
		queen.src = './PieceImages/WhiteQueen.png';
	}
	else { 
		queen.src = './PieceImages/BlackQueen.png';
	}
	return queen;
}

function generateRookImg(currentChar) { 
	rook = new Image(0, 0);
	if(currentChar == 'R') { 
		rook.src = './PieceImages/WhiteRook.png';
	}
	else { 
		rook.src = './PieceImages/BlackRook.png';
	}
	return rook;
}

async function getNumberOfMoves(moveset) { 
	numberOfMoves = 1;
	for(i = 0; i < moveset.length; i++) { 
		if(moveset.charAt(i) == ' ') { 
			numberOfMoves++;
		}
	}
	return numberOfMoves;
}
//Probably one of two functions in this entire program that needs to be async...
async function sleep(ms) { 
	return new Promise(resolve => setTimeout(resolve, ms));
}


async function removeAllImgDiv() { 
	squares = document.querySelectorAll('.square');
	for(i = 0; i < squares.length; i++) { 
		if(squares[i].hasChildNodes()) { 
			squares[i].removeChild(squares[i].childNodes[0]);
		}
	}
}
