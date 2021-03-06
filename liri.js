require('dotenv').config()

// modules
const Twitter = require('twitter'),
    Spotify = require('node-spotify-api'),
    util = require('util'),
    inquirer = require('inquirer'),
    request = require('request'),
    moment = require('moment'),
    fs = require('fs'),
    wrap = require('word-wrap'),
    colors = require('colors')

// consts
const TWITTER_DATE_FORMAT = 'ddd MMM DD HH:mm:ss ZZ YYYY', // date provided in the format of Thu Apr 12 22:29:39 +0000 2018
    OUTPUT_DATE_FORMAT = 'dddd, MMMM Do YYYY [at] h:mm A', // date displayed in the format of Thursday, April 12th 2018 at 6:29 PM
    TWEET_PARAMS = { screen_name: 'bootcamp_marce', count: 20 },
    DEFAULT_SONG = 'Ace of Base The Sign',
    TRACK_FORMAT = '"%s"'.bold.yellow + ' by '.dim + '%s'.bold.yellow + ' on the album '.dim + '"%s"'.bold.yellow + '\n\n%s'.cyan,
    MOVIE_QUERY_FORMAT = 'http://www.omdbapi.com/?t=%s&y=&plot=short&apikey=trilogy',
    DEFAULT_MOVIE = 'Mr. Nobody',
    MOVIE_FORMAT = '"%s" '.bold.yellow + '(%s)'.dim + '\nIMDB Rating: '.bold + '%s\n' + 'Tomatometer: '.bold + '%s\n' +
        'Country: '.bold + '%s\n' + 'Language: '.bold + '%s\n\n' + '%s\n\n'.yellow + 'Starring: '.bold + '%s',
    WRAP_WIDTH = 72,
    SEPARATOR = '*'.repeat(WRAP_WIDTH).green

// init
const keys = require('./keys.js'),
    spotify = new Spotify(keys.spotify),
    client = new Twitter(keys.twitter)

// input
const argCommand = process.argv[2],
    argParameter = process.argv.slice(3)

// process arguments
processCommand(argCommand, argParameter)

/**
 * Process command with optional parameter
 * @param {string} command (required) Supported commands: my-tweets, spotify-this-song, movie-this, do-what-it-says
 * @param {string} parameter (optional) 
 */
function processCommand(command, parameter) {
    if (command) {
        log('Processing %s command', command)
    }

    switch (command) {
        case 'my-tweets':
            displayTweets()
            break
        case 'spotify-this-song':
            spotifySong(parameter || DEFAULT_SONG)
            break
        case 'movie-this':
            omdbMovie(parameter || DEFAULT_MOVIE)
            break
        case 'do-what-it-says':
            performTaskFromFile()
            break
        default:
            // if no (or an invalid) command is entered, use Inquirer to prompt for a command
            promptForCommand()
    }
}

/**
 * Use Inquirer to present available commands
 */
function promptForCommand() {
    inquirer.prompt(
        {
            type: 'list',
            message: 'What would you like to do?',
            choices: [
                { name: 'View my tweets', value: 'my-tweets' },
                { name: 'Find song on Spotify', value: 'spotify-this-song' },
                { name: 'Get movie information', value: 'movie-this' },
                { name: 'Perform task from file', value: 'do-what-it-says' },
                'exit'
            ],
            name: 'command'
        }
    ).then(commandResponse => {
        console.log(commandResponse.command)
        let inputCommand = commandResponse.command

        switch (inputCommand) {
            case 'spotify-this-song':
            case 'movie-this':
                let prompt = {
                    type: 'input',
                    name: 'parameter'
                }

                // change prompt message depending on the input command
                prompt.message = inputCommand == 'spotify-this-song' ? 'Enter a song name:' : 'Enter a movie name'

                // prompt user for the parameter
                inquirer.prompt(
                    prompt
                ).then(parameterResponse => {
                    processCommand(inputCommand, parameterResponse.parameter)
                })
                break
            case 'exit':
                break
            // my-tweets and do-what-i-say don't require a parameter
            case 'my-tweets':
            case 'do-what-it-says':
            default:
                processCommand(inputCommand)
        }
    })
}

/**
 * Use Inquirer to prompt user to continue
 */
function promptToContinue() {
    inquirer.prompt(
        {
            type: 'confirm',
            message: 'Would you like to continue?',
            name: 'continue'
        }
    ).then(confirmation => {
        if (confirmation.continue) {
            promptForCommand()
        }
    })
}

/**
 * Displays the most recent 20 tweets
 */
function displayTweets() {
    client.get('statuses/user_timeline', TWEET_PARAMS,
        function (error, tweets, response) {
            if (!error) {
                tweets.forEach(tweet => {
                    log(SEPARATOR)
                    log(tweet.text.cyan)
                    log('Tweeted on %s'.dim, moment(tweet.created_at, TWITTER_DATE_FORMAT).format(OUTPUT_DATE_FORMAT))
                })
                log(SEPARATOR)
            }
            promptToContinue()
        }
    )
}

/**
 * Pull information on a Spotify track specified by songName
 * @param {string} songName 
 */
function spotifySong(songName) {
    spotify.search({ type: 'track', query: songName, limit: 1 },
        function (error, data) {
            if (!error) {
                let track = data.tracks.items[0]
                if (!track) {
                    log('Could not find song')
                } else {
                    log(SEPARATOR)
                    log(TRACK_FORMAT,
                        track.name,
                        track.artists.map(artist => artist.name).join(', '),
                        track.album.name,
                        track.external_urls.preview_url || ('No preview available. Full track URL: ' + track.external_urls.spotify)
                    )
                    log(SEPARATOR)
                }
            } else {
                log('Error occurred: ' + error)
            }
            promptToContinue()
        }
    )
}

/**
 * Pull information on a movie specified by movieName
 * @param {string} movieName 
 */
function omdbMovie(movieName) {
    request(util.format(MOVIE_QUERY_FORMAT, movieName.replace(' ', '+')),
        function (error, response, data) {
            if (!error && response.statusCode === 200) {
                let movie = JSON.parse(data)

                log(SEPARATOR)
                log(MOVIE_FORMAT,
                    movie.Title,
                    movie.Year,
                    movie.Ratings.find(rating => { return rating.Source === 'Internet Movie Database' }).Value,
                    movie.Ratings.find(rating => { return rating.Source === 'Rotten Tomatoes' }).Value,
                    movie.Country,
                    movie.Language,
                    movie.Plot,
                    movie.Actors
                )
                log(SEPARATOR)
            } else {
                log(response.statusCode, error)
                log('Could not find movie')
            }
            promptToContinue()
        }
    )
}

/**
 * Perform whichever task is specified in the random.txt file
 */
function performTaskFromFile() {
    let fileCommand, fileParameter
    [fileCommand, fileParameter] = fs.readFileSync('random.txt', 'utf8').split(',')
    processCommand(fileCommand, fileParameter)
}

/**
 * Log to console and to file
 */
function log(...rest) {
    let logStr = wrap(util.format.apply(null, rest), { width: WRAP_WIDTH });

    console.log(logStr)
    fs.appendFileSync('log.txt', logStr + '\n')
}