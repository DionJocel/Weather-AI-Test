class WeatherAI {
    constructor() {
        this.apiKey = 'bcd89c7f8d14ad6ddf578432e489e760';
        this.currentWeatherType = 'today'; // Default to today
        this.elements = {
            location: document.getElementById('location'),
            date: document.getElementById('date'),
            temperature: document.getElementById('temperature'),
            description: document.getElementById('description'),
            feelsLike: document.getElementById('feelsLike'),
            humidity: document.getElementById('humidity'),
            windSpeed: document.getElementById('windSpeed'),
            precipitation: document.getElementById('precipitation'),
            weatherIcon: document.getElementById('weatherIcon'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            voiceButton: document.getElementById('voiceButton'),
            chatInterface: document.getElementById('chatInterface')
        };

        this.init();
    }

    init() {
        this.setupDate('today');
        this.setupVoiceRecognition();
        this.getLocation();
    }

    setupDate(weatherType) {
        const date = new Date();
        if (weatherType === 'tomorrow') {
            date.setDate(date.getDate() + 1);
        }

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateText = weatherType === 'tomorrow' ? 'Tomorrow' : 'Today';
        this.elements.date.textContent = `${dateText}'s Weather - ${date.toLocaleDateString('en-US', options)}`;
    }

    setupVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.elements.voiceButton.style.display = 'none';
            this.showError('Voice recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.elements.voiceButton.addEventListener('click', () => {
            this.toggleVoiceRecognition();
        });

        this.recognition.onstart = () => {
            this.elements.voiceButton.classList.add('listening');
            this.elements.voiceButton.textContent = '🎤 Listening...';
        };

        this.recognition.onend = () => {
            this.elements.voiceButton.classList.remove('listening');
            this.elements.voiceButton.textContent = '🎤 Ask about weather';
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            this.processVoiceCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            this.showError('Voice recognition error: ' + event.error);
        };
    }

    toggleVoiceRecognition() {
        if (this.elements.voiceButton.classList.contains('listening')) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    processVoiceCommand(transcript) {
        this.addChatMessage(transcript, 'user');

        // Determine if user wants today or tomorrow's weather
        if (transcript.includes('tomorrow')) {
            this.currentWeatherType = 'tomorrow';
            this.addChatMessage("I'll get tomorrow's weather forecast for you mah g!", 'ai');
        } else if (transcript.includes('today') || transcript.includes('now')) {
            this.currentWeatherType = 'today';
            this.addChatMessage("I'll get today's weather for you mah g!", 'ai');
        } else {
            // Default to today but ask for clarification
            this.currentWeatherType = 'today';
            this.addChatMessage("I'll get today's weather for you mah g! Say 'tomorrow' if you want tomorrow's forecast.", 'ai');
        }

        this.getLocation();
    }

    addChatMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        messageDiv.textContent = message;
        this.elements.chatInterface.appendChild(messageDiv);
        this.elements.chatInterface.scrollTop = this.elements.chatInterface.scrollHeight;
    }

    getLocation() {
        this.showLoading();

        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.getWeatherData(latitude, longitude);
            },
            (error) => {
                this.hideLoading();
                this.showError('Unable to retrieve your location. Using default location (London).');
                this.getWeatherData(51.5074, -0.1278);
            }
        );
    }

    async getWeatherData(lat, lon) {
        try {
            console.log('Fetching weather for:', lat, lon);

            if (this.currentWeatherType === 'today') {
                // Use current weather API for today
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
                );

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                console.log('Today Weather API response:', data);
                this.processTodayWeatherData(data);
            } else {
                // Use forecast API for tomorrow
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
                );

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                console.log('Tomorrow Weather API response:', data);
                this.processTomorrowWeatherData(data);
            }

        } catch (error) {
            console.error('Weather API error:', error);
            this.hideLoading();
            this.showError('Failed to fetch weather data. Using sample data instead.');

            const mockData = this.generateMockWeatherData();
            this.displayWeatherData(mockData);
        }
    }

    processTodayWeatherData(data) {
        const weatherInfo = {
            location: `${data.name}, ${data.sys.country}`,
            temperature: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed * 3.6),
            precipitation: 0,
            description: data.weather[0].description,
            condition: data.weather[0].main,
            weatherType: 'today'
        };

        // Estimate precipitation for today
        if (weatherInfo.condition === 'Rain' || weatherInfo.condition === 'Drizzle') {
            weatherInfo.precipitation = 80;
        } else if (weatherInfo.condition === 'Thunderstorm') {
            weatherInfo.precipitation = 90;
        } else {
            weatherInfo.precipitation = Math.floor(Math.random() * 30);
        }

        this.displayWeatherData(weatherInfo);
    }

    processTomorrowWeatherData(data) {
        // Get tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0); // Use noon for forecast

        // Find the forecast closest to tomorrow noon
        let closestForecast = data.list[0];
        let closestDiff = Math.abs(new Date(data.list[0].dt * 1000) - tomorrow);

        data.list.forEach(forecast => {
            const forecastTime = new Date(forecast.dt * 1000);
            const diff = Math.abs(forecastTime - tomorrow);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestForecast = forecast;
            }
        });

        const weatherInfo = {
            location: `${data.city.name}, ${data.city.country}`,
            temperature: Math.round(closestForecast.main.temp),
            feelsLike: Math.round(closestForecast.main.feels_like),
            humidity: closestForecast.main.humidity,
            windSpeed: Math.round(closestForecast.wind.speed * 3.6),
            precipitation: Math.round((closestForecast.pop || 0) * 100), // Probability of precipitation
            description: closestForecast.weather[0].description,
            condition: closestForecast.weather[0].main,
            weatherType: 'tomorrow'
        };

        this.displayWeatherData(weatherInfo);
    }

    generateMockWeatherData() {
        const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm'];
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

        return {
            location: 'Your Location',
            temperature: Math.floor(Math.random() * 30) + 5,
            feelsLike: Math.floor(Math.random() * 30) + 5,
            humidity: Math.floor(Math.random() * 50) + 30,
            windSpeed: Math.floor(Math.random() * 30) + 5,
            precipitation: Math.floor(Math.random() * 100),
            description: randomCondition.toLowerCase(),
            condition: randomCondition,
            weatherType: this.currentWeatherType
        };
    }

    displayWeatherData(data) {
        this.hideLoading();
        this.setupDate(data.weatherType);

        this.elements.location.textContent = data.location;
        this.elements.temperature.textContent = `${data.temperature}°C`;
        this.elements.description.textContent = data.description;
        this.elements.feelsLike.textContent = `${data.feelsLike}°C`;
        this.elements.humidity.textContent = `${data.humidity}%`;
        this.elements.windSpeed.textContent = `${data.windSpeed} km/h`;
        this.elements.precipitation.textContent = `${data.precipitation}%`;

        this.elements.weatherIcon.textContent = this.getWeatherIcon(data.condition);

        const aiResponse = this.generateAIResponse(data);
        this.addChatMessage(aiResponse, 'ai');
    }

    getWeatherIcon(condition) {
        const icons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '❄️',
            'Mist': '🌫️',
            'Fog': '🌫️'
        };
        return icons[condition] || '⛅';
    }

    generateAIResponse(weatherData) {
        const timeText = weatherData.weatherType === 'tomorrow' ? 'tomorrow' : 'today';

        const responses = [
            `${timeText === 'tomorrow' ? "Tomorrow's weather" : "Today's weather"} is ${weatherData.description} cuh! Temperature will be around ${weatherData.temperature}°C cuh, feels like ${weatherData.feelsLike}°C man. ${weatherData.precipitation > 50 ? "Better bring an umbrella mah g! ☔" : "Great weather to go outside mah g! 🌤️"}`,
            `For ${timeText} ba sah?: ${weatherData.temperature}°C and ${weatherData.description}. Wind speed is ${weatherData.windSpeed} km/h, tatagos ka na n'yan cuh. ${weatherData.humidity > 70 ? "It's quite humid " + timeText + " cuh ingat ka palagi." : "Comfortable humidity levels cuh ingat ka parin palagi."}`,
            `${timeText === 'tomorrow' ? "Tomorrow's forecast" : "Current conditions"} ba kamo: ${weatherData.description} with ${weatherData.temperature}°C. ${weatherData.precipitation > 30 ? `There's a ${weatherData.precipitation}% chance of rain dala ka payong cuh ingat palagi mah g.` : "No rain expected " + timeText + " ingat padin palagi mah g."}`,
            `Weather update for ${timeText} mah g: ${weatherData.description}, ${weatherData.temperature}°C. ${weatherData.windSpeed > 20 ? "It's a bit windy " + timeText + " cuh baka tumagos kana n'yan!" : "Light winds " + timeText + " mah g hindi ka naman tatagos eh."} ${weatherData.precipitation > 50 ? "Might rain dala ka umbrella mah g ingat palagi! ☔" : "Clear skies mah g ingat padin palagi! ☀️"}`
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }

    showLoading() {
        this.elements.loading.style.display = 'block';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.elements.errorMessage.style.display = 'none';
        }, 5000);
    }
}