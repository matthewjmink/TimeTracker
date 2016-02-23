angular.module('TimeTracker.config', [])
  .constant('FBUrl', 'https://mattminktimetracker.firebaseio.com');

var tt = angular.module("TimeTracker", ["firebase", "ngMaterial", "ngRoute", "TimeTracker.config"]);

tt.config(
    function($routeProvider) {
        $routeProvider
            // home page
            .when('/', {
                templateUrl : 'templates/time-tracker.html',
                controller    : 'ttController',
                name: 'home'
            })
            // allocations page
            .when('/allocations', {
                templateUrl : 'templates/allocations.html',
                controller    : 'allocationsController',
                name: 'allocations'
            })
            // report page
            .when('/report', {
                templateUrl : 'templates/weekly-report.html',
                controller    : 'reportController',
                name: 'report'
            });
});

tt.directive("mainNav",
    function($route, $location) {
        return {
            restrict: 'A',
            templateUrl: 'templates/_nav.html',
            replace: true,
            link: linkFunc
        };
        function linkFunc(scope, elem) {
            var activeRoute;
            scope.$on("$routeChangeSuccess", function (event, current, previous) {
                activeRoute = current.$$route.name;
            });
            scope.isActive = function(route) {
                return activeRoute === route;
            }
        }
    }
);

tt.controller("reportController",
    function($scope, $firebaseArray, $mdDialog, $interval, FBUrl) {
        var taskRef = new Firebase(FBUrl + "/Tasks");
        var trackersRef = new Firebase(FBUrl + "/Trackers");
        var allocationsRef = new Firebase(FBUrl + "/Allocations");
        var trackerCollection = $firebaseArray(trackersRef);
        var allocationsCollection = $firebaseArray(allocationsRef);

        $scope.days = {};
        $scope.tasks = $firebaseArray(taskRef);
        $scope.time = {};
        $scope.getProjectTotal = getProjectTotal;
        $scope.getDayTotal = getDayTotal;
        $scope.getWeekTotal = getWeekTotal;
        $scope.thisWeek = thisWeek;
        $scope.nextWeek = nextWeek;
        $scope.previousWeek = previousWeek;

        setWeek();

        $scope.toggleNotes = function (){
            this.notesVisible = !this.notesVisible;
        };

        function getAllocations(){
            $scope.time = {};
            trackerCollection.$ref().orderByKey().startAt($scope.days.monday).endAt($scope.days.friday).on("child_added", function(snapshot) {
                var item = snapshot.val();
                var key = snapshot.key();
                if(!$scope.time[key]){
                    $scope.time[key] = {};
                }
                for (id in item) {
                    var start = moment(item[id].start);
                    var end   = moment(item[id].end);
                    var diff = end.diff(start, 'hours', true);
                    if(!$scope.time[key][item[id].task]){
                        $scope.time[key][item[id].task] = {};
                        $scope.time[key][item[id].task].hours = diff;
                    } else {
                        $scope.time[key][item[id].task].hours += diff;
                    }
                    if(item[id].notes) {
                        if(typeof $scope.time[key][item[id].task].notes === 'undefined') {
                            $scope.time[key][item[id].task].notes = item[id].notes;
                        } else {
                            $scope.time[key][item[id].task].notes += ', ' + item[id].notes;
                        }
                    }
                }
            });
        }

        function getDayTotal(day) {
            var total = 0;
            for (task in $scope.time[day]) {
                total += $scope.time[day][task].hours;
            }
            return total;
        }

        function getProjectTotal(task) {
            var total = 0;
            var allocation = 0;
            for (day in $scope.time) {
                if($scope.time[day][task]){
                    total += $scope.time[day][task].hours || 0;
                }
            }
            this.projectTotal = total;
            for (var i = 0; i < allocationsCollection.length; i++) {
                if(allocationsCollection[i].task === this.task.task){
                    allocation = allocationsCollection[i].hours;
                }
            }
            this.projectVariance = this.projectTotal - allocation;
            return total;
        }

        function getWeekTotal() {
            var total = 0;
            for (day in $scope.time) {
                for (task in $scope.time[day]) {
                    total += $scope.time[day][task].hours;
                }
            }
            return total;
        }

        function nextWeek() {
            setWeek('next');
        }

        function previousWeek() {
            setWeek('previous');
        }

        function thisWeek() {
            setWeek();
        }

        function setWeek(week) {
            var monday = moment().day('Monday');
            var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            $scope.days = {};
            for (var i = 0; i < days.length; i++) {
                var day = moment().day(days[i]);
                if(week === 'previous') {
                    day.subtract(1, 'weeks');
                } else if(week === 'next') {
                    day.add(1, 'weeks');
                }
                $scope.days[days[i].toLowerCase()] = day.format('YYYYMMDD');
            }
            $scope.isToday = $scope.days.monday === monday.format('YYYYMMDD');
            $scope.monday = monday.format('M/D');
            getAllocations();
        }

    }
);

tt.controller("allocationsController",
    function($scope, $firebaseArray, $mdDialog, $interval, FBUrl) {
        var tasksRef = new Firebase(FBUrl + "/Tasks");
        var allocationsRef = new Firebase(FBUrl + "/Allocations");
        var defaultsSet = false;
        $scope.tasks = $firebaseArray(tasksRef);
        $scope.allocations = $firebaseArray(allocationsRef);
        $scope.taskAllocations = {};
        $scope.totalAllocation = 0;

        $scope.tasks.$loaded().then(function(list){
            setDefaults(list);
        });

        $scope.allocations.$loaded().then(function(list){
            setDefaults(list, true);
        });

        $scope.updateAllocation = function() {
            var hours = $scope.taskAllocations[this.task.task].hours;
            setTotalAllocation();
            for (var i = 0; i < $scope.allocations.length; i++) {
                if($scope.allocations[i].task === this.task.task){
                    var key = $scope.allocations.$keyAt($scope.allocations[i]);
                    var item = $scope.allocations.$getRecord(key);
                    item.hours = hours;
                    $scope.allocations.$save(item);
                    return;
                }
            }
        }

        function setTotalAllocation () {
            $scope.totalAllocation = 0;
            angular.forEach($scope.taskAllocations, function(project) {
                $scope.totalAllocation += project.hours;
            });
        }

        function setDefaults(list, override) {
            for (var i = 0; i < list.length; i++) {
                if(!$scope.taskAllocations[list[i].task] || override){
                    var value = override ? list[i].hours : 0;
                    $scope.taskAllocations[list[i].task] = {
                        hours: value
                    };
                }
            }
            console.log(override);
            if(override){
                setTotalAllocation();
            }
        }

    }
);

tt.controller("ttController",
    function($scope, $firebaseArray, $mdDialog, $interval, FBUrl) {
        var taskRef = new Firebase(FBUrl + "/Tasks");
        $scope.tasks = $firebaseArray(taskRef);
        $scope.isToday = true;
        initTrackers(new Date());

        $scope.tasks.$loaded().then(function(list){
            for (i = 0; i < list.length; i++){
                if (list[i].tracker) {
                    $scope.runningTask = list[i];
                    break;
                }
            }
            if ($scope.runningTask){
                $scope.runningElapsedTime = $scope.elapsedTime($scope.runningTask.tracker);
                $scope.startTimer();
            }
         });

        $scope.$on('$destroy', function() {
            // Make sure that the interval is destroyed too
            $scope.stopTimer();
        });

        $scope.startTimer = function () {
            $scope.timer = $interval(function () {
                $scope.runningElapsedTime = $scope.elapsedTime($scope.runningTask.tracker);
            }, 60000);
        };

        $scope.stopTimer = function () {
            if (angular.isDefined($scope.timer)) {
                $interval.cancel($scope.timer);
                $scope.timer = undefined;
            }
        };

        $scope.initTimeEdits = function () {
            this.inEditStart = false;
            this.inEditEnd = false;
        };

        $scope.initTaskEdits = function () {
            this.inEdit = false;
            this.inEditStart = false;
        };

        $scope.saveEdit = function (){
            this.inEdit = false;
            $scope.tasks.$save(this.task);
        };

        $scope.saveEditStart = function (runningTracker){
            if (this.tracker) {
                var newStart = Date.create(moment(this.tracker.start).format('MM/DD/YYYY') + ' ' + this.editStart);
            }
            else {
                var newStart = Date.create(moment(this.editStartDate).format('MM/DD/YYYY') + ' ' + this.editStart);
            }
            if ( Object.prototype.toString.call(newStart) === "[object Date]" ) {
                if ( !isNaN( newStart.getTime() ) ) {
                    if (this.tracker) {
                        this.tracker.start = newStart.getTime();
                    }
                    else {
                        this.task.tracker.start = newStart.getTime();
                    }
                    if (runningTracker) {
                        $scope.tasks.$save(this.task);
                        $scope.runningElapsedTime = $scope.elapsedTime(this.task.tracker);
                    }
                    else{
                        $scope.trackers.$save(this.tracker);
                    }
                }
            }
            this.inEditStart = false;
        };

        $scope.saveEditEnd = function (){
            var newEnd = Date.create(moment(this.tracker.start).format('MM/DD/YYYY') + ' ' + this.editEnd);
            if ( Object.prototype.toString.call(newEnd) === "[object Date]" ) {
                if ( !isNaN( newEnd.getTime() ) ) {
                    this.tracker.end = newEnd.getTime();
                    $scope.trackers.$save(this.tracker);
                }
            }
            this.inEditEnd = false;
        };

        $scope.startEdit = function () {
            this.inEdit = true;
        };

        $scope.startEditNotes = function () {
            this.inEditNotes = true;
        };

        $scope.updateEditNotes = function ($event, ref) {
            if($event.keyCode === 13) {
                $scope.saveEditNotes(this);
            }
        };

        $scope.saveEditNotes = function (ref) {
            var _this = (ref) ? ref : this;
            $scope.trackers.$save(_this.tracker);
            _this.inEditNotes = false;
        };

        $scope.startEditStart = function () {
            this.inEditStart = true;
            if (this.tracker){
                var start = new Date(this.tracker.start);
            }
            else {
                var start = new Date(this.task.tracker.start);
            }
            this.editStartDate = start;
            this.editStart = moment(start).format('h:mmA');
        };

        $scope.startEditEnd = function () {
            this.inEditEnd = true;
            var end = new Date(this.tracker.end);
            this.editEnd = moment(end).format('h:mmA');
        };

        $scope.startTracker = function (task) {
            if ($scope.runningTask)
                $scope.stopTracker($scope.runningTask);
            $scope.runningTask = task;
            task.tracker = {
                start: new Date().getTime(),
                task: task.task
            };
            task.running = true;
            $scope.tasks.$save(task);
            $scope.runningElapsedTime = '0hrs 0mins';
            $scope.startTimer();
        };

        $scope.stopTracker = function (task) {
            $scope.runningTask = null;
            var targetDate = new Date(task.tracker.start);
            var targetDateString = moment(targetDate).format('YYYYMMDD');
            console.log(targetDateString);
            var targetTrackers = $firebaseArray(new Firebase(FBUrl + "/Trackers/"+targetDateString));
            var tracker = task.tracker;
            var endDate = new Date();
            endDate.setDate(targetDate.getDate());
            tracker.end = endDate.getTime();
            targetTrackers.$add(tracker);
            task.running = false;
            task.tracker = null;
            $scope.tasks.$save(task);
            $scope.stopTimer();
        };

        $scope.elapsedTime = function (tracker) {
            if (tracker.end){
                var elapsed = tracker.end - tracker.start;
            }
            else {
                var elapsed = new Date().getTime() - tracker.start;
            }
            var dur = moment.duration(elapsed);
            return dur.hours() + 'hrs ' + dur.minutes() + 'mins' ;
        };

        $scope.addTask = function () {
            if($scope.addedTask){
                $scope.tasks.$add({task: $scope.addedTask, running: false});
                $scope.addedTask = "";
            }
        };

        $scope.totalDayDuration = function () {
            var totalDuration = moment.duration(1);
            if ($scope.trackers.length > 0){
                for(i = 0; i < $scope.trackers.length; i++){
                    var tracker = $scope.trackers[i];
                    if(tracker.end){
                        var elapsed = tracker.end - tracker.start;
                        totalDuration.add(moment.duration(elapsed));
                    }
                }
                return totalDuration.hours() + 'hrs and ' + totalDuration.minutes() + 'mins';
            }
            else {
                return '';
            }
        };

        $scope.showConfirmTask = function(ev, task) {
            var confirm = $mdDialog.confirm()
                .title('Delete Task?')
                .content('Are you sure you want to delete the task ' + task.task)
                .ariaLabel('Delete Task')
                .ok('Yes')
                .cancel('No')
                .targetEvent(ev);
            $mdDialog.show(confirm).then(function() {
                $scope.tasks.$remove(task);
            }, function() {
                //don't delete
            });
        };

        $scope.showConfirmTracker = function(ev, tracker) {
            var confirm = $mdDialog.confirm()
                .title('Delete Tracked Time?')
                .content('Are you sure you want to delete the time tracked for task ' + tracker.task)
                .ariaLabel('Delete Tracked Time')
                .ok('Yes')
                .cancel('No')
                .targetEvent(ev);
            $mdDialog.show(confirm).then(function() {
                $scope.trackers.$remove(tracker);
            }, function() {
                //don't delete
            });
        };

        $scope.dateBack = function () {
            var date = $scope.trackedDate;
            date.addDays(-1);
            initTrackers(date);
        };

        $scope.dateForward = function () {
            var date = $scope.trackedDate;
            date.addDays(1);
            initTrackers(date);
        };

        $scope.dateToday = function () {
            initTrackers(new Date());
        };

        $scope.keyPressed = function (ev) {
            if(ev.which === 13){
                $scope.addTask();
            }
        };

        function initTrackers (date) {
            $scope.trackedDate = date;
            $scope.isToday = moment($scope.trackedDate).isSame(moment(), "day");
            var dateString = moment(date).format('YYYYMMDD');
            var trackerRef = new Firebase(FBUrl + "/Trackers/"+dateString);
            $scope.trackers = $firebaseArray(trackerRef);
        }
    }
);

tt.directive('showFocus', function($timeout) {
    return function(scope, element, attrs) {
        scope.$watch(attrs.showFocus,
            function (newValue) {
                $timeout(function() {
                        newValue && element[0].focus();
                });
            },true);
    };
});
