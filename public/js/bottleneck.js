const LINE_CANVAS_PADDING = 20;

$(document).ready(function () {
  const query_string = window.location.search;
  const url_params = new URLSearchParams(query_string);
  let dataset_name = url_params.get("dataset");
  let bottleneck_name = url_params.get("bottleneck");
  if (!dataset_name) {
    dataset_name = "flower";
    bottleneck_name = "flower_new";
  }
  load_data(dataset_name, bottleneck_name, (dataset) => {
    let visualizer = new Visualizer();
    initialize(visualizer, dataset);
  });
});

function initialize(visualizer, dataset) {
  let query_string = window.location.search;
  visualizer.visualize(null, dataset);

  // Remove the loading mask
  $("#loading-mask").removeClass("active");
  setTimeout(() => $("#loading-mask").attr("style", "display: none"), 200);
}

class Visualizer {
  constructor() {
    this.card_template = $.templates("#card");
    this.history_card_template = $.templates("#history-card");
    this.concept_card_template = $.templates("#concept-card");
    this.ground_truth_card_template = $.templates("#ground-truth-card");
    this.classes_card_template = $.templates("#classes-card");
    this.concept_details_template = $.templates("#concept-details-card");
    this.slider_template = $.templates("#slider");
  }

  visualize(cur_class_id, dataset) {
    $(window).off("resize");
    $("#left").unbind("scroll");
    $("#middle").unbind("scroll");
    $("#curr-dataset").text(dataset.dataset_name); //TODO temporary
    // Push history
    const new_url = new URL(window.location.href);
    new_url.search = `?dataset=${dataset.dataset_name}&bottleneck=${dataset.bottleneck_name}`;
    window.history.replaceState({ path: new_url.href }, "", new_url.href);

    // Get the data
    let data = dataset.get_classes_card_data("left");
    // let data = dataset.get_card_data(datapoint, "middle");

    // Render the object onto the page
    // $("#middle-inner").html(this.classes_card_template.render(data));
    $("#left-inner").html(this.classes_card_template.render(data));

    // Setup the callbacks

    data.classes.forEach(({ class_id, category }) => {
      $(`#left-category-${class_id}`).click(() => {
        this.visualize(class_id, dataset);
      });
    });

    // If the step id is present, directly visualize that step
    if (cur_class_id != null) {
      $("#right-inner").html("");
      this.visualize_class(cur_class_id, dataset);
    } else {
      $("#middle-inner").html("");
      $("#left-line-canvas").attr("style", "display: none");
    }
  }

  visualize_class(class_id, dataset) {
    // Open the middle canvas
    $("#left-line-canvas").attr("style", "display: block");

    // Push history
    const new_url = new URL(window.location.href);
    new_url.search = `?dataset=${dataset.dataset_name}&bottleneck=${dataset.bottleneck_name}&class_id=${class_id}`;
    window.history.replaceState({ path: new_url.href }, "", new_url.href);

    // Highlight the step in the left
    $(`#left-category-${class_id}`)
      .addClass("active")
      .siblings()
      .removeClass("active");

    // Clear the middle
    $("#middle-inner").html("");

    const cur_class_data = dataset.classes_data[`${class_id}`];
    const concepts = cur_class_data["concepts"];

    // add ground truth card
    let cls_name = cur_class_data["name"];
    $("#middle-inner").append(
      this.ground_truth_card_template.render({
        img_paths: dataset.class_ground_truth[cls_name].map((url) => {
          return {
            path: `${dataset.dataset_name}/images/${url}`,
          };
        }),
      })
    );

    // add download annotations button
    $("#middle-inner").append(
      `<button id="download-button" class="annotations-button">Download All Annotations</button>`
    );

    $("#middle-inner").append(
      `<p class="annotations-button-caption">(Make sure to save annotations for <b>every modified class</b> before downloading!)</p>`
    );

    // add save annotations button
    $("#middle-inner").append(
      `<button id="save-button" class="annotations-button">Save Annotations</button>`
    );

    // save annotations handler
    $("#save-button").click(() => {
      $.ajax({
        method: "PUT",
        url: `/save-annotations/${dataset.dataset_name}/${dataset.bottleneck_name}/${class_id}`,
        data: JSON.stringify({
          new_concepts: this.get_current_annotations(concepts),
        }),
        traditional: true,
        contentType: "application/json",
      }).done(({ success }) => {
        if (success) {
          alert("Annotations saved!");
        } else {
          alert("An error occurred when saving annotations.");
        }
      });
    });

    // download annotations handler
    $("#download-button").click(() => {
      $.get(
        `/download-annotations/${dataset.dataset_name}/${dataset.bottleneck_name}`,
        ({ data, success }) => {
          if (success) {
            const blob = new Blob([JSON.stringify(data)], {
              type: "application/json",
            });
            saveAs(
              blob,
              `${dataset.dataset_name}-${
                dataset.bottleneck_name
              }-annotations-${new Date().toISOString()}.json`
            );
          } else {
            console.error(data);
            alert(
              "An error occurred while trying to download annotations; try again."
            );
          }
        }
      );
    });

    // render and set up slider
    $("#middle-inner").append(
      this.slider_template.render({
        slider_value: concepts.length,
        max_value: concepts.length,
      })
    );
    $("#concepts-slider").change(() => {
      // this.render_concepts(class_id, $("#concepts-slider").val(), dataset);
      this.display_num_concepts(class_id, $("#concepts-slider").val(), dataset);
      $("#num-concepts-shown").html($("#concepts-slider").val());
    });

    $("#middle-inner").append(`<div id="concepts-container"></div>`);

    this.render_concepts(class_id, concepts.length, dataset);
  }

  visualize_concept(concept_id, class_id, dataset) {
    // set new URL
    const new_url = new URL(window.location.href);
    new_url.search = `?dataset=${dataset.dataset_name}&bottleneck=${dataset.bottleneck_name}&class_id=${class_id}&concept_id=${concept_id}`;
    window.history.replaceState({ path: new_url.href }, "", new_url.href);

    // highlight original concept card
    $(`#middle-${concept_id}-card`)
      .addClass("selected-card")
      .siblings()
      .removeClass("selected-card");

    // clear the right pane and render concept details card
    $("#right-inner").html("");

    const cur_concept_data = dataset.concepts_data[`${concept_id}`];
    $("#right-inner").append(
      this.concept_details_template.render({
        concept_id: concept_id,
        elem_id: `${concept_id}-concept-details-card`,
        title: cur_concept_data["name"],
        images: cur_concept_data["images_classes"].map(
          ([img_path, img_class]) => {
            return {
              img_path: `${dataset.dataset_name}/images/${img_path}`,
              img_class: img_class,
            };
          }
        ),
      })
    );
  }

  render_concepts(class_id, num_concepts, dataset) {
    $("#concepts-container").html("");

    const cur_class_data = dataset.classes_data[`${class_id}`];
    const concepts = cur_class_data["concepts"];
    // const concepts_sliced = cur_class_data["concepts"].slice(0, num_concepts);

    // For each concept, render the concept card
    concepts.forEach(([concept_id]) => {
      let data = dataset.get_concept_card_data(
        concept_id,
        `middle-${concept_id}`
      );
      $("#concepts-container").append(this.concept_card_template.render(data));
      if (
        dataset.concept_to_prior &&
        dataset.concept_to_prior[concept_id] === parseInt(class_id)
      )
        $(`#concept-label-${concept_id}`).css("color", "red");

      // set up callbacks for each concept detail card
      $(`#middle-${concept_id}-card`).click(() => {
        this.visualize_concept(concept_id, class_id, dataset);
      });

      // edit name handler
      $(`#${concept_id}-edit-name-button`).click(() => {
        const current_edited_name = $(`#${concept_id}-new-name`).html() ?? "";
        $(`#${concept_id}-edit-name-container`).prepend(
          `<textarea id="${concept_id}-new-name-textarea" class="text-annotation">${current_edited_name}</textarea>`
        );
        $(`#${concept_id}-edit-name-button`).toggle();
        $(`#${concept_id}-save-name-button`).toggle();
        $(`#${concept_id}-edited-name`).remove();

        // $.ajax({
        //   method: "PUT",
        //   url: `/save-annotations/${dataset.dataset_name}/${dataset.bottleneck_name}/${class_id}`,
        //   data: JSON.stringify({
        //     new_concepts: this.get_current_annotations(concepts),
        //   }),
        //   traditional: true,
        //   contentType: "application/json",
        // }).done(({ success }) => {
        //   if (success) {
        //     alert("Annotations saved!");
        //   } else {
        //     alert("An error occurred when saving annotations.");
        //   }
        // });
      });

      // save name handler
      $(`#${concept_id}-save-name-button`).click(() => {
        const new_name = $(`#${concept_id}-new-name-textarea`).val();
        $(`#${concept_id}-new-name-textarea`).remove();
        if (new_name)
          $(`#${concept_id}-edit-name-container`).prepend(
            `<div id="${concept_id}-edited-name" class="edited-concept-title"><b>Edited name: </b><span id=${concept_id}-new-name>${new_name}</span></div>`
          );

        $(`#${concept_id}-edit-name-button`).toggle();
        $(`#${concept_id}-save-name-button`).toggle();
      });
      $(`#${concept_id}-save-name-button`).toggle();
    });

    // get annotations data and render appropriately, if it exists
    $.get(
      `/get-annotations/${dataset.dataset_name}/${dataset.bottleneck_name}/${class_id}`,
      ({ data, err }) => {
        if (data) {
          data["concepts"].forEach(
            ({ concept_id, annotations, edited_name }) => {
              $(`#${concept_id}-annotation-incorrect-map`).prop(
                "checked",
                annotations.includes(0)
              );
              $(`#${concept_id}-annotation-incorrect-ground`).prop(
                "checked",
                annotations.includes(1)
              ); // check checkboxes if needed

              // render textbox annotation
              let stringAnnotation = annotations.find(
                (elem) => typeof elem === "string"
              );
              if (stringAnnotation) {
                $(`#${concept_id}-text-annotation`).html(stringAnnotation);
              }

              // render edited names
              if (edited_name) {
                $(`#${concept_id}-edit-name-container`).prepend(
                  `<div id="${concept_id}-edited-name" class="edited-concept-title"><b>Edited name: </b><span id=${concept_id}-new-name>${edited_name}</span></div>`
                );
              }
            }
          );
        } else if (err) {
          console.error(err);
          alert("An error occurred trying to retrieve annotation data");
        }
      }
    );

    // show/hide specified number of concepts
    this.display_num_concepts(class_id, num_concepts, dataset);
  }

  display_num_concepts(class_id, num_concepts, dataset) {
    const cur_class_data = dataset.classes_data[`${class_id}`];
    const concepts_to_show = cur_class_data["concepts"].slice(0, num_concepts);
    const concepts_to_hide = cur_class_data["concepts"].slice(num_concepts);

    concepts_to_show.forEach(([concept_id]) => {
      $(`#middle-${concept_id}-card`).css("display", "flex");
    });
    concepts_to_hide.forEach(([concept_id]) => {
      $(`#middle-${concept_id}-card`).css("display", "none");
    });

    // Setup a scroll callback
    let draw = () => {
      let svg_elem = $("#left-line-canvas");
      let svg_x = svg_elem.position().left;
      let svg_y = svg_elem.position().top;

      // Get d3 svg and clear the canvas
      let svg = d3.select("#left-line-canvas");
      svg.selectAll("*").remove();

      // Get left element
      let left_elem = $(
        `#left-category-${class_id} .card-section-caption-anchor-circle`
      );
      let left_elem_position = left_elem.position();
      let left_x = left_elem_position.left - svg_x + 6 + LINE_CANVAS_PADDING;
      let left_y = left_elem_position.top - svg_y + 6;

      // draw lines to each concept
      concepts_to_show.slice(0, num_concepts).forEach(([concept_id, wt]) => {
        let middle_elem = $(`#middle-${concept_id}-card .card-left-anchor`);
        let middle_elem_position = middle_elem.position();
        let middle_x =
          middle_elem_position.left - svg_x + 6 + LINE_CANVAS_PADDING;
        let middle_y = middle_elem_position.top - svg_y + 6;

        // Draw a text
        let text_y = middle_y > left_y ? middle_y + 20 : middle_y - 10;
        svg
          .append("text")
          .text(`${wt}`.substring(0, 7))
          .style("font-size", "18px")
          .style("font-weight", "bold")
          .style("fill", "red")
          .attr("x", middle_x - 85)
          .attr("y", text_y);
      });
    };
    $(window).resize(draw);
    $("#middle").scroll(draw);
    $("#left").scroll(draw);
    draw();
  }

  // TODO will need to integrate class_id as a parameter
  // only works on visualized concepts for now
  get_current_annotations(concepts) {
    return concepts.map(([concept_id]) => {
      const checked_bool_arr = [
        $(`#${concept_id}-annotation-incorrect-map`).is(":checked"),
        $(`#${concept_id}-annotation-incorrect-ground`).is(":checked"),
      ];
      const text_annotation = $(`#${concept_id}-text-annotation`).val();
      const text_annotation_arr = text_annotation ? [text_annotation] : [];

      // get edited name (either saved or not)
      const edited_name =
        $(`#${concept_id}-new-name`).html() ||
        $(`#${concept_id}-new-name-textarea`).val();

      return {
        concept_id: concept_id,
        annotations: checked_bool_arr
          .flatMap((bool, idx) => (bool ? idx : []))
          .concat(text_annotation_arr),
        ...(edited_name && { edited_name }), // include edited_name if not falsy
      };
    });
  }
}

//TODO maybe bring datapoint back into use when refactoring?
class Datapoint {
  constructor(task_id, class_id, parent_datapoint) {
    this.task_id = `${task_id}`;
    this.class_id = class_id;
    this.parent_datapoint = parent_datapoint;
  }
}
