/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, browser: true */
/*global $, define, brackets */

define(function (require, exports, module) {
    "use strict";
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Menus               = brackets.getModule("command/Menus"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        ProjectManager      = brackets.getModule("project/ProjectManager");
    
    var SHOW_GH_ISSUES    = "gh_issues_cmd";
    var TARGET_REGEXP   = new RegExp("(<target name=\"(([^\"])*))+", "img");
    var nodeConnection;
    
    var contextMenu     = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        menuItems       = [],
        buildMenuItem   = null;
        
    var $ghPanel,
        $ghResults;
    
    // Helper function that chains a series of promise-returning
    // functions together via their done callbacks.
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }
    
    function _handleToggleGHStatus() {
        
        if (!$ghPanel.is(":visible")) {
            $ghPanel.show();
            $("#gh-panel .close").one("click", function () { _handleToggleGHStatus(); });
        
            CommandManager.get(SHOW_GH_ISSUES).setChecked(true);
        } else {
            $ghPanel.hide();
            CommandManager.get(SHOW_GH_ISSUES).setChecked(false);
        }
        
        EditorManager.resizeEditor();
    }
    
    AppInit.appReady(function () {
        
        nodeConnection = new NodeConnection();
        
        // Helper function that tries to connect to node
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            
            connectionPromise.fail(function () {
                console.error("[brackets-gh] failed to connect to node");
            });
            
            return connectionPromise;
        }
        
        // Helper function that loads our domain into the node server
        function loadGHDomain() {
            var path        = ExtensionUtils.getModulePath(module, "node/GHDomain"),
                loadPromise = nodeConnection.loadDomains([path], true);

            loadPromise.then(function(){
                nodeConnection.domains.gh.setPath(ProjectManager.getProjectRoot().fullPath);
            }).fail(function (error, b) {
                console.log("[brackets-gh] failed to load gh domain");
                console.log(error);
            });

            return loadPromise;
        }

        chain(connect, loadGHDomain);
        
        $(ProjectManager).on("projectOpen", function (event, projectRoot) {
            nodeConnection.domains.gh.setPath(projectRoot.fullPath);
        });
        
        function _open() {
            _listGHIssues();
            _handleToggleGHStatus();
        }
        
        function _listGHIssues() {
            var $row,
                state = $ghPanel.find(".issue-state.disabled").data("state"),
                assignee = $ghPanel.find('.assignee')[0].selectedIndex == 1;
            
            $ghResults.find("tr:gt(0)").remove();
            
            nodeConnection.domains.gh.listIssues(state, assignee).done(function(data) {
                data.issues.forEach(function(issue) {
                    $row = $("<tr>").append(
                                $("<td>").html(issue.number)
                            ).append(
                                $("<td style='font-weight: 500;'>").html(
                                    issue.title + "<a class='pull-right' href='" + issue.html_url + "'>Open in Github</a>" 
                                )
                            );
                    $ghResults.append($row);
                });
            });
        }
        
        CommandManager.register("Github Issues", SHOW_GH_ISSUES, _open);
        
        // Register command
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(SHOW_GH_ISSUES, "", Menus.LAST);
        
        $('.content').append('<div id="gh-issues" class="bottom-panel">'
                            + ' <div class="toolbar simple-toolbar-layout">'
                            + '     <div class="title">GH ISSUES</div>'
                            + '     <button class="btn btn-mini issue-state disabled" data-state="open">Open</button>'
                            + '     <button class="btn btn-mini issue-state" data-state="closed">Closed</button>'
                            + '     <select class="assignee">'
                            + '         <option>Everyone\'s Issues</option>'
                            + '         <option>Assigned to you</option>'
                            + '         <option disabled="disabled">Created by you</option>'
                            + '         <option disabled="disabled">Mentioning you</option>'
                            + '     </select>'
                            + '     <a href="#" class="close">&times;</a>'
                            + ' </div>'
                            + ' <div class="table-container">'
                            + '     <table id="gh-results" class="table table-striped">'
                            + '         <tr><th>#</th><th>Title</th></tr>'
                            + '     </table>'
                            + ' </div>'
                            + '</div>');
        
        $ghPanel      = $("#gh-issues");
        $ghResults    = $("#gh-results");
        
        $(".assignee").change(function(event) {
            _listGHIssues();
        });
        
        $(".issue-state").click(function(event) {
            $(".issue-state").toggleClass("disabled");
            _listGHIssues();
        });
    });
});