import React, { useState, useRef, useEffect } from 'react';
import PropTypes from "prop-types";
import {EditScribblePad} from "../../Components/HandNotes/EditScribblePad";
import {I18nProvider} from "../../Components/i18n/I18nProvider";

export function EditHandNotes(props) {
  const {hostData} = props;
  const {patient, imageNoteConceptName, handnoteConceptName, locationUuid, encounterTypeUuid, observationMapper, onSaveSuccess, observation, observationFilter} = hostData;

    return (
        <I18nProvider>
            <EditScribblePad
                patient={patient}
                handnoteConceptName={handnoteConceptName}
                imageNoteConceptName={imageNoteConceptName}
                locationUuid={locationUuid}
                encounterTypeUuid={encounterTypeUuid}
                observationMapper={observationMapper}
                onSaveSuccess={onSaveSuccess}
                observation={observation}
                observationFilter={observationFilter}
            />
        </I18nProvider>
    );
}
EditHandNotes.propTypes = {
    hostData: PropTypes.Object,
}