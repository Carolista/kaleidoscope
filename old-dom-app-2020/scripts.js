/*** KALEIDOSCOPE ***/

/*
    My goal was to make this interactive for users. They should be able to:
        - Choose a color scheme
        - Select a specific color from that scheme as the current color
        - Always have white and off-black (#222) as options
        - Fill the individual hexagons in the kaleidoscope with different colors
        - Edit only one "slice", emphasized on hover, and the others will reflect it
        - If the user changes color schemes, the entire kaleidoscope needs to reflect the change
        - There should be a reset button with a confirmation popup

    BONUS: Make the page work in light mode or dark mode
*/

/** DATA **/

let schemes = [
    { "name": "Daytona", "colors": ["#b09e99","#64b6ac","#c0fdfb","#fad4c0","#fee9e1"]},
    { "name": "Tahoe", "colors": ["#bc4749", "#c17c74","#7a6c5d","#bcac9b","#ddc9b4"]},
    { "name": "Tahiti", "colors": ["#2ec4b6","#ff9f1c","#ffbf69","#ffecb6","#cbf3f0"]},  
    { "name": "Club Neon", "colors": ["#aa3e98","#9368b7","#9297c4","#3599a7","#75dddd"]},
    { "name": "Wisteria", "colors": ["#360568","#5b2a86","#7785ac","#9ac6c5","#4eb870"]},
    { "name": "Fresh Melon", "colors": ["#bc4749","#386641","#6a994e","#a7c957","#f2e8cf"]},
    { "name": "Lake House", "colors": ["#dd1c1a","#086788","#07a0c3","#f0c808","#fff1d0"]},
    { "name": "Sitka", "colors": ["#254441","#43aa8b","#db504a","#ff6f59","#b2b09b"]},
    { "name": "Flagstaff", "colors": ["#175e7a","#2a9d8f","#e76f51","#f4a261","#e9c46a"]},
    { "name": "Lush Lipstick", "colors": ["#4f000b","#720026","#ce4257","#ff7f51","#ff9b54"]},
    { "name": "Disco", "colors": ["#0f4c5c","#5f0f40","#9a031e","#e36414","#fb8b24"]}
];
// HT: Hex values for palettes copied, rather efficiently, from https://coolors.co/palettes/trending


/** DOM STUFF **/

// Event listener for page load
window.addEventListener("load", function() {
    console.log('Page loaded.');
    init();
});

// DOM code for page elements
function init() {

    let base = "#ffffff";
    let accent = "#222222";
    let borderDefault = "#eeeeee";
    let darkMode = false;

    let currentScheme = schemes[Math.floor(Math.random() * schemes.length)]; // randomized default on page load
    let currentColor = currentScheme.colors[0]; // default to first color of scheme
    let hexagons = document.getElementsByClassName("hexagon"); // array of all hexagons
    let blanks = document.getElementsByClassName("blank"); // array of all blanks
    let darkModeButton = document.getElementById("dark-mode");
    let resetButton = document.getElementById("reset");
    let pageTitle = document.getElementById("page-title");

    function displayColorSchemes() {
        for (let i=0; i< schemes.length; i++) {
            for (let j=0; j<5; j++) {
                document.getElementById("group" + i + "-" + j).style.backgroundColor = schemes[i].colors[j];
            }
        }
    }
    
    function displayCurrentOptions() {
        for (let i=0; i<5; i++) {
            document.getElementById("color" + i).style.backgroundColor = currentScheme.colors[i];
        }  
    }

    function resetBorders() {
        let choices = document.getElementsByClassName("color-option");
        for (let i=0; i<7; i++) {
            choices[i].style.borderColor = borderDefault;
            choices[i].style.borderWidth = 2 + "px";
            choices[i].style.margin = 9 + "px";
        }
    }

    function highlightSelection(element) {
        element.style.borderColor = accent;
        element.style.borderWidth = 4 + "px";
        element.style.margin = 7 + "px";
    }

    function setBlanks() {
        for (let i=0; i < blanks.length; i++) {
            blanks[i].style.backgroundColor = "transparent";
        }
    }

    function renderPageColors() {
        displayColorSchemes();
        displayCurrentOptions(); // first five colors
        document.getElementById("base").style.backgroundColor = base;
        document.getElementById("accent").style.backgroundColor = accent;
        resetBorders();
        highlightSelection(document.getElementById("color0"));
        setMiscStyles();
    }

    function setMiscStyles() {
        // Change body background color
        document.body.style.backgroundColor = base;
        // Change page title and button colors
        pageTitle.style.color = accent;
        darkModeButton.style.color = accent;
        darkModeButton.style.borderColor = base;
        resetButton.style.color = accent;
        resetButton.style.borderColor = base;
    }

    // Refresh entire kaleidoscope with new color scheme *before* currentScheme is overwritten
    function updateKaleidoscopeScheme(indexOfNewScheme) {
        let oldColor;
        let indexOfColor;
        let newColor;
        for (let i=0; i < hexagons.length; i++) {
            oldColor = hexagons[i].style.backgroundColor;
            // If not white or grey
            if (oldColor) { 
                indexOfColor = currentScheme.colors.indexOf(rgbToHex(oldColor));
                newColor = schemes[indexOfNewScheme].colors[indexOfColor];
                hexagons[i].style.backgroundColor = newColor;
            }
        }
    }

    function resetDesign() {
        for (let i=0; i < hexagons.length; i++) {
            hexagons[i].style.backgroundColor = accent;
        }
    }

    // First time to populate colors and base/accent/border defaults
    renderPageColors();
    setBlanks();
    
    // Reset design first time so DOM has colors (it can't access style sheet);
    resetDesign();
    

    /** EVENT LISTENERS **/

    // Use event delegation for click events on page
    document.addEventListener('click', function (event) {

        // If user wants to change color scheme
        if (event.target.id.slice(0,5) === "group") {
            let indexOfScheme;
            // Get index of scheme in array
            if (event.target.id.length % 2 === 0) {
                indexOfScheme = Number(event.target.id.slice(5,6));
            } else {
                indexOfScheme = Number(event.target.id.slice(5,7));
            }
            // Change colors of kaleidoscope
            updateKaleidoscopeScheme(indexOfScheme);
            // Set current scheme
            currentScheme = schemes[indexOfScheme];
            // Update display on page
            displayCurrentOptions();
            // Set default selection to first color if not grey or white
            if (event.target.id !== "base" && event.target.id !== "accent") {
                currentColor = currentScheme.colors[0];
                resetBorders();
                highlightSelection(document.getElementById("color0"));
            }
        }

        // If user wants to change current color
        if (event.target.matches(".color-option")) {
            resetBorders();
            currentColor = rgbToHex(event.target.style.backgroundColor); // stay consistent
            highlightSelection(event.target);
        }

        // If user clicks on hexagon, either change color or toggle back to default
        if (event.target.matches(".clickable")) {
            let existingColor = rgbToHex(event.target.style.backgroundColor);
            let toggleOff = (existingColor === currentColor);
            for (let i=0; i < hexagons.length; i++) {
                if (hexagons[i].classList[1] === event.target.classList[1]) { // mirror effect
                    if (toggleOff) {
                        hexagons[i].style.backgroundColor = accent;
                    } else {
                        hexagons[i].style.backgroundColor = currentColor;  
                    }                
                }
            }      
        } 

        // If user toggles dark mode button
        if (event.target === darkModeButton) {
            // Switch values of all reference variables
            if (!darkMode) {
                darkMode = true;
                base = "#222222";
                accent = "#ffffff";
                darkModeButton.innerHTML = "Light Mode";
            } else {
                darkMode = false;
                base = "#ffffff";
                accent = "#222222";
                darkModeButton.innerHTML = "Dark Mode";
            }
            // Flip any hexagons that were base or accent.
            for (let i=0; i < hexagons.length; i++) {
                if (rgbToHex(hexagons[i].style.backgroundColor) === base) {
                    hexagons[i].style.backgroundColor = accent;
                } else if (rgbToHex(hexagons[i].style.backgroundColor) === accent) {
                    hexagons[i].style.backgroundColor = base;
                }
            }
            // Re-render colors on page
            renderPageColors();
        }

        // If user clicks on reset button
        if (event.target === resetButton) {
            if (window.confirm("Are you sure you want to reset your design? This cannot be undone.")) {
                resetDesign();
                console.log("Design reset.");
            }         
        }

    }, false);

    // Use event delegation for mouseovers
    document.addEventListener('mouseover', function (event) {

        // Hover effect over specific clickables
        if (event.target.matches(".clickable")) {
            event.target.style.opacity = "0.7"; // just the one
        }

        // Fade all except clickables when hovering over entire kaleidoscope
        if (event.target.id === "kaleidoscope" || event.target.matches(".hexagon") || event.target.matches("hex-row")) {
            for (let i=0; i < hexagons.length; i++) {
                if (! hexagons[i].matches(".clickable")) {
                    hexagons[i].style.opacity = "0.2"; // all non-clickables
                } 
            }
        }

        // Force opacity return when hovering below kaleidoscope but still in column 
        if (event.target.id === "button-container") {
            for (let i=0; i < hexagons.length; i++) {
                hexagons[i].style.opacity = "1.0";
            }
        }

        // Hovering over individual colors
        if (event.target.matches(".color-option")) {
            event.target.style.borderColor = accent;
        }

        // Hovering over buttons
        if (event.target.matches(".pseudobutton")) {
            event.target.style.borderColor = accent;
        }


    }, false);

    // Use event delegation for mouseouts
    document.addEventListener('mouseout', function (event) {

        // For single clickables    
        if (event.target.matches(".clickable")) {
            event.target.style.opacity = "1.0";
        }
        
        // When moving off kaleidoscope (and column, to reduce glitchiness)
        if (event.target.id === "kaleidoscope" || event.target.id === "right-column") {
            for (let i=0; i < hexagons.length; i++) {
                hexagons[i].style.opacity = "1.0";
            }
        }

        // Moving off individual colors 
        if (event.target.matches(".color-option")) {
            event.target.style.borderColor = borderDefault;
        }

        // Hovering over buttons
        if (event.target.matches(".pseudobutton")) {
            event.target.style.borderColor = base;
        }

    }, false);

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    
    function rgbToHex(rgb) {
        // parse rgb as string of code to get individual numbers
        let paren1 = rgb.indexOf("(");
        let comma1 = rgb.indexOf(",");
        let r = Number(rgb.slice(paren1+1,comma1));
        rgb = rgb.slice(comma1+1);
        let comma2 = rgb.indexOf(",");
        let paren2 = rgb.indexOf(")");
        let g = Number(rgb.slice(0,comma2));
        let b = Number(rgb.slice(comma2+1,paren2));
        // convert and concatenate to hex code string
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }
    



}