/* global Module, Log, moment */

/* Magic Mirror
 * Module: MMM-NextCloud-Tasks
 *
 * By Jan Ryklikas
 * MIT Licensed.
 */



Module.register("MMM-NextCloud-Tasks", {
	defaults: {
		updateInterval: 60000,
		hideCompletedTasks: null,
		sortMethod: "priority",
		colorize: false,
		startsInDays: 999999,
		displayStartDate: true,
		dueInDays: 999999,
		displayDueDate: true,
		showWithoutStart: true,
		showWithoutDue: true,
		hideCompletedTasksAfter: 1, // 1 day
		dateFormat: "DD.MM.YYYY",
		headings: [null],
		playSound: true,
		offsetTop: 0,
		offsetLeft: 0,
		toggleTime: 1600 // mseconds
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	toDoList: null,
	error: null,
	audio: null, // define audio to prelaod the sound

	start: function () {
		var self = this;

		//Flag for check if module is loaded
		self.loaded = false;
       
		// Preload the sound
		this.audio = new Audio('/modules/MMM-NextCloud-Tasks/sounds/task_finished.wav');
		this.audio.load();

		// A little fallback if the config is still of the old type
		// this is for "listUrl" which was a string before
		if (self.verifyConfig(self.config)) {
			if (self.isListUrlSingleValue(self.config.listUrl)) {
				self.error = "A little config Error in MMM-Nextcloud-Task: 'listUrl' should be an array now as the module now supports multiple urls. Example:<br>" +
					"<div class='MMM-Nextcloud-Tasks-New-Config-Note'>" +
					"<span style='color: #e34c26;'>Old:</span><br> <span style='font-family: Courier; color: lightblue;'>listUrl</span>: <span style='font-family: Courier; color: brown;'>\"https://my-nextcloud.com/remote.php/dav/calendars/cornelius/private-tasks/\"</span><span style='font-family: Courier; color: white;'>,</span><br>" +
					"<span style='color: #4caf50;'>New:</span><br> <span style='font-family: Courier; color: lightblue;'>listUrl</span>: [<span style='font-family: Courier; color: brown;'>\"https://my-nextcloud.com/remote.php/dav/calendars/cornelius/private-tasks/\"</span><span style='font-family: Courier; color: white;'>,</span>]" +
					"<span style='color: #4caf50;'><br>Example with two urls:</span><br> <span style='font-family: Courier; color: lightblue;'>listUrl</span>: [" +
					"<span style='font-family: Courier; color: brown;'>\"https://my-nextcloud.com/remote.php/dav/calendars/cornelius/private-tasks/\"</span><span style='font-family: Courier; color: white;'>,</span><br> " +
					"<span style='font-family: Courier; color: brown;'>\"https://my-nextcloud.com/remote.php/dav/calendars/cornelius/work-tasks/\"</span><span style='font-family: Courier; color: white;'></span>]," +
					"</div>";
				self.updateDom();
				return;
			}
		// this is for the old "hideCompletedTasks" boolean which now is "hideCompletedTasksAfter" with a number
		if (this.config.hideCompletedTasks !== null) {
			const infoText =
				"<span style='color:  #e34c26;'>Deprecation:</span> <span style='color: #ffffff;'>The old 'hideCompletedTasks' boolean is deprecated. Use </span>" +
				"<span style='color: #ffcc00;'>hideCompletedTasksAfter</span><span style='color: #ffffff;'> to specify the number of days after which completed tasks are hidden." +
				"Use. 0 to hide at once. Example: </span>" +
			    "<br><span style='font-family: Courier; color: lightblue;'>hideCompletedTasksAfter</span>:  <span style='font-family: Courier; color: blue;'>1</span><span style='font-family: Courier; color: white;'>,</span><br></br>"
			this.error = infoText;
			self.updateDom();
			return;
		}


			// Schedule update timer.
			self.getData();
			setInterval(function () {
				self.getData();
				self.updateDom();
			}, self.config.updateInterval);
		} else {
			Log.info("config invalid");
			self.error = "config invalid";
			self.updateDom();
		}
	},

	isListUrlSingleValue: function (listUrl) {
		return typeof listUrl === "string";
	},



	/*
	 * getData
	 * function example return data and show it in the module wrapper
	 * get a URL request
	 *
	 */
	getData: function () {
		this.sendSocketNotification(
			"MMM-NextCloud-Tasks-UPDATE",
			{
				id: this.identifier,
				config: this.config
			}
		);
	},

	getDom: function () {
		let self = this;

		// embed font awesome for testing on windows as you cannot see the icons otherwise
		// TODO: comment out after testing
	/* 	let link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css";
		document.head.appendChild(link); */
		// end of fontawesome embed

		// create element wrapper for show into the module
		let wrapper = document.createElement("div");
		wrapper.className = "MMM-NextCloud-Tasks-wrapper";

		if (self.toDoList) {
			wrapper.appendChild(self.renderList(self.toDoList));
			self.error = null;
		} else {
			wrapper.innerHTML = "<div>Loading...</div>";
		}

		if (self.error) {
			wrapper.innerHTML = "<div>" + self.error + "</div>";
		}

		// Initialize long press handlers after the DOM is updated
		setTimeout(() => {
			self.initLongPressHandlers();
		}, 0);

		return wrapper;
	},

	// create list of tasks

	renderList: function (children, isTopLevel = true) {
		let self = this;

		let red = "<span style=\"color:#e3516e\">"
		let yellow = "<span style=\"color:#e1e34f\">"
		let blue = "<span style=\"color:#2f26f4\">"
		let grey = "<span style=\"color:#646464\">"
		let endSpan = "</span>"
		let checked = "<span class=\"fa fa-fw fa-check-square\"></span>"
		let unchecked = "<span class=\"fa fa-fw fa-square\"></span>"

		let ul = document.createElement("ul");
		for (const element of children) {
			if (element.status === "COMPLETED") {
				if (typeof this.config.hideCompletedTasksAfter === "number") {
					const completedDate = new Date(element.completed.split(':')[1]);
					const daysSinceCompleted = (new Date() - completedDate) / (1000 * 60 * 60 * 24);
					if (daysSinceCompleted > this.config.hideCompletedTasksAfter) {
						continue;
					}
				}
			}

			const now = new Date();

			if (element.start) {
				const start = new Date(element.start);
				const daysUntilStart = (start - now) / (1000 * 60 * 60 * 24);
				if (daysUntilStart > self.config.startsInDays) {
					continue;
				}
			} else if (!self.config.showWithoutStart) {
				continue;
			}

			if (element.end) {
				const end = new Date(element.end);
				const daysUntilDue = (end - now) / (1000 * 60 * 60 * 24);
				if (daysUntilDue > self.config.dueInDays) {
					continue;
				}
			} else if (!self.config.showWithoutDue) {
				continue;
			}

			let icon = (element.status === "COMPLETED" ? checked : unchecked);
			let li = document.createElement("li");
			if (isTopLevel) {
				li.classList.add("MMM-NextCloud-Tasks-Toplevel");
			}
			let p = element.priority;
			let color = (p < 5 ? red : (p == 5 ? yellow : (p <= 9 ? blue : grey)));

			if (!this.usedUrlIndices) {
				this.usedUrlIndices = [];
			}
			if (!this.usedUrlIndices.includes(element.urlIndex)) {
				this.usedUrlIndices.push(element.urlIndex);
				const headingText = this.config.headings[element.urlIndex];
				if (headingText !== null && headingText !== "null" && headingText !== undefined) {
					let h2 = document.createElement("h2");
					h2.className = "MMM-NextCloud-Tasks-Heading-" + element.urlIndex;
					h2.textContent = headingText;
					ul.appendChild(h2);
				}
			}

			if (self.config.colorize) {
				li.innerHTML = "<div class='MMM-NextCloud-Task-List-Item' data-url-index='" + element.urlIndex + "' id='" + element.uid + "' vtodo-filename='" + element.filename + "'>" + color + icon + endSpan + " " + element.summary + "</div>";
			} else {
				li.innerHTML = "<div class='MMM-NextCloud-Task-List-Item' data-url-index='" + element.urlIndex + "' id='" + element.uid + "' vtodo-filename='" + element.filename + "'>" + icon + " " + element.summary + "</div>";
			}

			if ((self.config.displayStartDate && element.start) || (self.config.displayDueDate && element.due)) {
				let dateSection = document.createElement("div");
				dateSection.className = "MMM-Nextcloud-Tasks-Date-Section";

				if (self.config.displayStartDate && element.start) {
					let spanStart = document.createElement("span");
					spanStart.className = "MMM-NextCloud-Tasks-StartDate";
					spanStart.textContent = " " + moment(element.start).format(self.config.dateFormat);
					dateSection.appendChild(spanStart);
				}
				if (self.config.displayDueDate && element.due) {
					let spanDue = document.createElement("span");
					spanDue.className = "MMM-NextCloud-Tasks-DueDate";
					spanDue.textContent = " " + moment(element.due).format(self.config.dateFormat);
					dateSection.appendChild(spanDue);
				}

				li.appendChild(dateSection);
			}

			if (typeof element.children !== "undefined") {
				let childList = self.renderList(element.children, false);
				childList.classList.add("MMM-NextCloud-Tasks-SubList");
				li.appendChild(childList);
			}
			ul.appendChild(li);
		}
		return ul;
	},

	// Animate list element when long clicking
	initLongPressHandlers: function () {
		console.debug("[MMM-Nextcloud-Tasks] ready for long press");
		const items = document.querySelectorAll(".MMM-NextCloud-Task-List-Item");
		console.log(items);
		items.forEach((item) => {
			let pressTimer = null;
			let startTime = 0;
			let blurInterval = null;

			const resetEffects = () => {
				clearTimeout(pressTimer);
				clearInterval(blurInterval);
				item.style.filter = "none";
				item.style.opacity = "1";
			};

			const startEffects = () => {
				startTime = Date.now();
				const effectSpeed = toggleTime / 50;
				blurInterval = setInterval(() => {
					const elapsed = Date.now() - startTime;
					if (elapsed >= toggleTime) {
						clearInterval(blurInterval);
						newState = toggleCheck(item);
						toggleEffectOnTimerEnd(item);
						console.debug("[MMM-Nextcloud-Tasks] new state: " + newState);
						console.debug("[MMM-Nextcloud-Tasks] item id: " + item.id);

						this.sendSocketNotification("MMM-NextCloud-Tasks-TOGGLE", {
							id: item.id,
							status: newState,
							config: this.config,
							urlIndex: item.getAttribute("data-url-index"),
							filename: item.getAttribute("vtodo-filename")
						});
						resetEffects();
					} else {
						const progress = elapsed / toggleTime;
						item.style.filter = `blur(${4 * progress}px)`;
						item.style.opacity = `${1 - progress}`;
					}
				}, effectSpeed);
			};

			const toggleEffectOnTimerEnd = (item) => {
				console.debug("[MMM-Nextcloud-Tasks] toggleEffectOnTimerEnd called");
				this.audio.play().catch(error => console.error("Error playing audio:", error));

				startTime = Date.now();
				const effecttoggleTime = 1200;
				const overlay = item.cloneNode(true);

				overlay.style.position = "absolute";
				overlay.style.top = (item.offsetTop + offsetTop) + "px";
				overlay.style.left = (item.offsetLeft + offsetLeft)+"px";
				overlay.style.color = "red";
				overlay.style.zIndex = "100000";
				overlay.style.pointerEvents = "none";
				overlay.style.filter = "none";
				overlay.style.opacity = "1";

				const styleEl = document.createElement("style");
				styleEl.innerHTML = `
				@keyframes fadeToBright {
					0% {
						color: red;
						opacity: 1;
					}
					85% {
						color: var(--color-text-bright);
					}
					100% {
						color: var(--color-text-bright);
						opacity: 0;
					}
				}
				`;
				document.head.appendChild(styleEl);

				overlay.style.animation = `fadeToBright ${effecttoggleTime}ms forwards`;
				item.parentElement.appendChild(overlay);

				item.style.transition = `filter ${effecttoggleTime}ms ease-in-out`;
				item.style.filter = "blur(10px)";
				setTimeout(() => {
					item.style.filter = "blur(0)";
				}, effecttoggleTime);

				setTimeout(() => {
					overlay.remove();
					item.style.transition = "none";
					item.style.filter = "none";
				}, effecttoggleTime + 1000);
			};

			const toggleCheck = (listItem) => {
				const iconSpan = listItem.querySelector(".fa");
				if (!iconSpan) return;
				const isChecked = iconSpan.classList.contains("fa-check-square");
				iconSpan.classList.toggle("fa-check-square", !isChecked);
				iconSpan.classList.toggle("fa-square", isChecked);
				return isChecked ? "unchecked" : "checked";
			};

			const startHandler = () => {
				Log.info("touch/mouse start on item: " + item.id);
				resetEffects();
				pressTimer = setTimeout(() => {}, toggleTime);
				startEffects(item);
			};

			item.addEventListener("mousedown", startHandler);
			item.addEventListener("touchstart", startHandler, { passive: true });
			item.addEventListener("mouseup", resetEffects);
			item.addEventListener("mouseleave", resetEffects);
			item.addEventListener("touchend", resetEffects);
			item.addEventListener("touchcancel", resetEffects);
		});
	},

	getStyles: function () {
		return [
			"MMM-NextCloud-Tasks.css",
		];
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "MMM-NextCloud-Tasks-Helper-TODOS#" + this.identifier) {
			this.toDoList = payload;
			this.updateDom();
		}
		if (notification === "MMM-NextCloud-Tasks-Helper-LOG#" + this.identifier) {
			Log.log("LOG: ", payload);
		}
		if (notification === "MMM-NextCloud-Tasks-Helper-ERROR#" + this.identifier) {
			Log.error("ERROR: ", payload);
			this.error = payload + "<br>";
			this.updateDom();
		}
	},

	verifyConfig: function (config) {
		if (
			typeof config.listUrl === "undefined" ||
			typeof config.webDavAuth === "undefined" ||
			typeof config.webDavAuth.username === "undefined" ||
			typeof config.webDavAuth.password === "undefined" ||
			typeof config.sortMethod === "undefined" ||
			typeof config.colorize === "undefined"
		) {
			this.error = "Config variable missing";
			Log.error("Config variable missing");
			return false;
		}
		return true;
	}
});