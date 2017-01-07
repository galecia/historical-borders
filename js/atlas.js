	window.onload = function(){
		var form = document.getElementById("statebox");
		form.style.display = "block";
		
		var gotostate = document.getElementById("gotostate");
		
		gotostate.onclick = function(){
			
			var link = makeLink(form);

			if (link.search('undefined') == -1){ 
			  /*open the link in the same window*/ 
			  form["state_select"].value = "";
			  form["link_type"][0].checked = true;
			  window.location.href = link;
			}
		};
	};
  
	function makeLink(form){
    	var link_type;
    	/*run through link_type values and see which one is selected */
    	for (var i = 0; i < form["link_type"].length; i++){
      		if (form["link_type"][i].checked){ 
      			link_type = form["link_type"][i].value;
      		}
      	}

    	var state = form["state_select"].value;
    	var link;
		var location = "http://" + window.location.host + "/borders";

    	/* conditional statements to build link based on the link_type */
    	if (link_type == "page") {
      		link = location + "/pages/" + state.split(";")[1] + ".html";
    	}
    	else if (link_type== "map") {
    		if (state == 'US;United_States'){
	    		link = "http://historical-county.newberry.org/website/USA/viewer.htm";
    		}
      		else{
      			link = "http://historical-county.newberry.org/website/" + state.split(";")[1] + "/viewer.htm";
      		}
    	}
    	else if (link_type == "metadata"){
      		link = location + "/documents/" + state.split(";")[0] + "_Metadata1.htm";
    	}
    	else {
      		link = "";
    	}
		
    	return link;
    }

