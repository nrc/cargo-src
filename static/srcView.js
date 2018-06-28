// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

import * as utils from './utils';
import { BreadCrumbs } from './breadCrumbs';
import { MenuHost, Menu } from './menus';
import { Highlight } from './highlight';


// Menus, highlighting on mouseover.
function add_ref_functionality(self) {
    for (const el of $("#div_src_view").find(".class_id")) {
        const element = $(el);
        const classes = el.className.split(' ');
        // FIXME[ES6]: use classes.find() and then execute following code
        let c = classes.find((c) => c.startsWith('class_id_'));
        if(c === undefined) {
            return;
        }
        element.hover(function() {
            $("." + c).css("background-color", "#d5f3b5");
        }, function() {
            $("." + c).css("background-color", "");
        });

        const id = c.slice('class_id_'.length);
        const showRefMenu = (ev) => {
            self.setState({ refMenu: { "top": ev.pageY, "left": ev.pageX, target: ev.target, id }});
            ev.preventDefault();
            ev.stopPropagation();
        };
        element.off("contextmenu");
        element.on("contextmenu", showRefMenu);
        element.addClass("hand_cursor");
    }
}

// props: location, onClose, target
// location: { "top": event.pageY, "left": event.pageX }
function LineNumberMenu(props) {
    let items = [];
    if (CONFIG.edit_command) {
        items.push({ id: "line_number_menu_edit", label: "edit", fn: edit, unstable: true });
    }
    if (CONFIG.vcs_link) {
        items.push({ id: "line_number_vcs", label: "view in VCS", fn: view_in_vcs });
    }
    return <Menu id={"div_line_number_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

// props: location, onClose, target, id
// location: { "top": event.pageY, "left": event.pageX }
function RefMenu(props) {
    let items = [];

    const file_loc = props.target.dataset.link.split(':');
    const file = file_loc[0];

    if (file != "search") {
        let data = utils.parseLink(file_loc);
        items.push({ id: "ref_menu_goto_def", label: "goto def", fn: () => props.app.loadSource(file, data) });
    }

    const docUrl = props.target.dataset.docLink;
    if (docUrl) {
        items.push({ id: "ref_menu_view_docs", label: "view docs", fn: () => window.open(docUrl, '_blank') });
    }
    const srcUrl = props.target.dataset.srcLink;
    if (srcUrl) {
        items.push({ id: "ref_menu_view_source", label: "view source", fn: window.open(srcUrl, '_blank') });
    }

    items.push({ id: "ref_menu_find_uses", label: "find all uses", fn: () => props.app.getUses(props.id) });

    let impls = props.target.dataset.impls;
    // XXX non strict comparison
    if (impls && impls != "0") {
        items.push({ id: "ref_menu_find_impls", label: "find impls (" + impls + ")", fn: () => props.app.getImpls(props.id) });
    }

    return <Menu id={"div_ref_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function view_in_vcs(target) {
    const link = target.dataset.link;
    const colon = link.lastIndexOf(':');
    const file_name = link.substring(CONFIG.workspace_root.length + 2, colon);
    const line_number = link.substring(colon + 1);
    window.open(CONFIG.vcs_link.replace("$file", file_name).replace("$line", line_number), '_blank');
}

function edit(target) {
    utils.request(
        'edit?file=' + target.dataset.link,
        function() {
            console.log("edit - success");
        },
        "Error with search edit",
        null
    );
}

// See https://github.com/Microsoft/TypeScript/issues/18134
/** @augments {React.Component<object, object>} */
export class SourceView extends React.Component {
    constructor(props) {
        super(props);
        this.state = { refMenu: null };
    }

    componentDidMount() {
        this.componentDidUpdate();
    }

    componentDidUpdate() {

        // Make source links active.
        var linkables = $("#div_src_view").find(".src_link");
        linkables.off("click");
        linkables.click((e) => {
            // The data for what to do on-click is encoded in the data-link attribute.
            // We need to process it here.
            e.preventDefault();
            e.stopPropagation();

            var docUrl = e.target.dataset.docLink;
            if (docUrl) {
                window.open(docUrl, '_blank');
                return;
            }

            var file_loc = e.target.dataset.link.split(':');
            var file = file_loc[0];

            if (file === "search") {
                this.props.app.getUses(file_loc[1]);
                return;
            }

            let data = utils.parseLink(file_loc);
            this.props.app.loadSource(file, data);
        });

        add_ref_functionality(this);

        if (this.props.highlight) {
            jumpToLine(this.props.highlight.line_start);
        }
    }

    render() {
        const path = this.props.path.join('/');
        let highlight_start = this.props.highlight && this.props.highlight.line_start || false;
        let highlight_end = this.props.highlight && this.props.highlight.line_end || false;
        let count = 0,
            numbers = [],
            lines = this.props.lines.map((l) => {
                count += 1;
                numbers.push(<LineNumber count={count}
                                         path={path}
                                         key={"num-" + count}
                                         highlight_start={highlight_start}
                                         highlight_end={highlight_end} />);
                return (<Line count={count} 
                              line={l}
                              key={"line-" + count}
                              highlight_start={highlight_start}
                              highlight_end={highlight_end} />);
            });

        let refMenu = null;
        if (this.state.refMenu) {
            const onClose = () => {
                return this.setState({ refMenu: null });
            };

            refMenu = <RefMenu app={this.props.app} location={this.state.refMenu} onClose={onClose} target={this.state.refMenu.target} id={this.state.refMenu.id} />;
        }

        return <div id="src" ref={node => this.node = node}> 
            <BreadCrumbs app={this.props.app} path={this.props.path} />
            <div id="div_src_view">
                <div id="div_src_contents">
                    <span className="div_src_line_numbers">
                        {numbers}
                    </span>
                    <span className="div_src_lines">
                        {lines}
                    </span>
                </div>
                {this.props.highlight ? <Highlight highlight={this.props.highlight} /> : null}
                {refMenu}
            </div>
        </div>;
    }
}

function jumpToLine(line) {
    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = line * $("#src_line_number_1").outerHeight() - 100;
    let div = document.getElementById("src");
    div.scroll(0, y);
}

class LineNumber extends MenuHost {
    constructor(props) {
        super(props);
        this.menuFn = LineNumberMenu;
    }

    renderInner() {
        const numId = "src_line_number_" + this.props.count;
        const link = this.props.path + ":" + this.props.count;
        const is_highlighted = this.props.highlight_start <= this.props.count && this.props.count <= this.props.highlight_end;
        return <div className={`div_src_line_number hand_cursor ${is_highlighted ? 'selected' : ''}`} id={numId} data-link={link}>
            {this.props.count}
        </div>;
    }
}

function Line(props) {
    const line = !props.line ? '&nbsp' : props.line;
    const lineId = "src_line_" + props.count;
    // Highlight middle lines; partial-line highlights rendered in Highlight component
    const is_highlighted = props.highlight_start < props.count && props.count < props.highlight_end;
    return <div className={`div_src_line ${is_highlighted ? 'selected' : ''}`} id={lineId} dangerouslySetInnerHTML={{__html: line}} />;
}
